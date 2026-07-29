import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  createUserTaskWithExecutor,
  deleteUserTaskWithExecutor,
  updateUserTaskWithExecutor,
} from '@/lib/auth/db';
import { db } from '@/server/db';
import { aiActionDrafts, courses, tasks } from '@/server/db/schema';
import { parseTorontoDueDate } from './date';
import { getOwnedDraft } from './drafts';
import {
  AI_DRAFT_PAYLOAD_VERSION,
  draftPayloadSchema,
  reviewPayloadSchema,
} from './types';

export class DraftExecutionError extends Error {
  constructor(
    readonly code:
      | 'DRAFT_CONFLICT'
      | 'DRAFT_EXPIRED'
      | 'DRAFT_NOT_FOUND'
      | 'DRAFT_STALE'
      | 'DRAFT_EXECUTION_FAILED',
  ) {
    super(code);
    this.name = 'DraftExecutionError';
  }
}

function audit(
  userId: string,
  draftId: string,
  actionCounts: { adds: number; updates: number; deletes: number },
  status: string,
) {
  console.info('AI action draft event', {
    userId,
    draftId,
    actionCounts,
    status,
  });
}

export async function classifyDraftState(
  userId: string,
  draftId: string,
): Promise<never> {
  const draft = await getOwnedDraft(userId, draftId);
  if (!draft) {
    throw new DraftExecutionError('DRAFT_NOT_FOUND');
  }
  if (draft.status === 'expired') {
    throw new DraftExecutionError('DRAFT_EXPIRED');
  }
  throw new DraftExecutionError('DRAFT_CONFLICT');
}

export async function rejectDraft(userId: string, draftId: string) {
  const rejected = await db
    .update(aiActionDrafts)
    .set({ status: 'rejected' })
    .where(
      and(
        eq(aiActionDrafts.id, draftId),
        eq(aiActionDrafts.userId, userId),
        eq(aiActionDrafts.status, 'pending'),
        gt(aiActionDrafts.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!rejected[0]) {
    return classifyDraftState(userId, draftId);
  }
  const actionCounts = reviewPayloadSchema.parse(
    rejected[0].reviewPayload,
  ).counts;
  audit(userId, draftId, actionCounts, 'rejected');
  return rejected[0];
}

export async function getAuthoritativeTasks(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) {
    return [];
  }
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds)))
    .orderBy(asc(tasks.id));
}

export async function executeDraft(userId: string, draftId: string) {
  const initial = await getOwnedDraft(userId, draftId);
  if (!initial) {
    throw new DraftExecutionError('DRAFT_NOT_FOUND');
  }
  if (initial.status === 'expired') {
    throw new DraftExecutionError('DRAFT_EXPIRED');
  }
  if (initial.status !== 'pending') {
    throw new DraftExecutionError('DRAFT_CONFLICT');
  }
  const actionCounts = reviewPayloadSchema.parse(initial.reviewPayload).counts;
  audit(userId, draftId, actionCounts, 'execution_started');

  try {
    const result = await db.transaction(async (tx) => {
      const claimed = await tx
        .update(aiActionDrafts)
        .set({ status: 'executing' })
        .where(
          and(
            eq(aiActionDrafts.id, draftId),
            eq(aiActionDrafts.userId, userId),
            eq(aiActionDrafts.status, 'pending'),
            gt(aiActionDrafts.expiresAt, new Date()),
            sql`${aiActionDrafts.payload}->>'payloadVersion' = ${String(AI_DRAFT_PAYLOAD_VERSION)}`,
          ),
        )
        .returning();
      if (!claimed[0]) {
        throw new DraftExecutionError('DRAFT_CONFLICT');
      }

      const payload = draftPayloadSchema.parse(claimed[0].payload);
      const taskVersions = new Map(
        Object.entries(claimed[0].taskVersions as Record<string, string>),
      );
      const existingTaskIds = payload.actions
        .filter((action) => action.type !== 'add_task')
        .map((action) => action.taskId)
        .sort();
      const lockedTasks = existingTaskIds.length
        ? await tx
            .select()
            .from(tasks)
            .where(
              and(eq(tasks.userId, userId), inArray(tasks.id, existingTaskIds)),
            )
            .orderBy(asc(tasks.id))
            .for('update')
        : [];
      if (
        lockedTasks.length !== existingTaskIds.length ||
        lockedTasks.some(
          (task) => task.updatedAt.toISOString() !== taskVersions.get(task.id),
        )
      ) {
        throw new DraftExecutionError('DRAFT_STALE');
      }

      const addCourseIds = [
        ...new Set(
          payload.actions
            .filter((action) => action.type === 'add_task')
            .map((action) => action.courseId),
        ),
      ].sort();
      const lockedCourses = addCourseIds.length
        ? await tx
            .select({ id: courses.id })
            .from(courses)
            .where(
              and(
                eq(courses.userId, userId),
                inArray(courses.id, addCourseIds),
              ),
            )
            .orderBy(asc(courses.id))
            .for('update')
        : [];
      if (lockedCourses.length !== addCourseIds.length) {
        throw new DraftExecutionError('DRAFT_STALE');
      }

      const affectedTaskIds = new Set(existingTaskIds);
      for (const action of payload.actions) {
        if (action.type === 'add_task') {
          const inserted = await createUserTaskWithExecutor(tx, userId, {
            courseId: action.courseId,
            title: action.task.title,
            notes: action.task.notes,
            dueDate: parseTorontoDueDate(action.task.dueDate),
            status: action.task.status,
            type: action.task.type,
            estimatedEffort: action.task.estimatedEffort,
            actualEffort: action.task.actualEffort,
          });
          affectedTaskIds.add(inserted.id);
          continue;
        }
        if (action.type === 'delete_task') {
          await deleteUserTaskWithExecutor(tx, action.taskId, userId);
          continue;
        }

        const { dueDate, ...changes } = action.changes;
        await updateUserTaskWithExecutor(tx, action.taskId, userId, {
          ...changes,
          ...(dueDate && { dueDate: parseTorontoDueDate(dueDate) }),
        });
      }

      await tx
        .update(aiActionDrafts)
        .set({ status: 'executed' })
        .where(
          and(
            eq(aiActionDrafts.id, draftId),
            eq(aiActionDrafts.userId, userId),
            eq(aiActionDrafts.status, 'executing'),
          ),
        );
      return [...affectedTaskIds];
    });

    audit(userId, draftId, actionCounts, 'approved');
    audit(userId, draftId, actionCounts, 'execution_succeeded');
    return {
      draft: await getOwnedDraft(userId, draftId),
      tasks: await getAuthoritativeTasks(userId, result),
    };
  } catch (error) {
    if (error instanceof DraftExecutionError) {
      if (error.code === 'DRAFT_CONFLICT') {
        return classifyDraftState(userId, draftId);
      }
      if (error.code === 'DRAFT_STALE') {
        await db
          .update(aiActionDrafts)
          .set({ status: 'stale', failureCode: 'task_state_changed' })
          .where(
            and(
              eq(aiActionDrafts.id, draftId),
              eq(aiActionDrafts.userId, userId),
              eq(aiActionDrafts.status, 'pending'),
            ),
          );
        audit(userId, draftId, actionCounts, 'stale');
        throw error;
      }
    }

    await db
      .update(aiActionDrafts)
      .set({ status: 'failed', failureCode: 'execution_failed' })
      .where(
        and(
          eq(aiActionDrafts.id, draftId),
          eq(aiActionDrafts.userId, userId),
          eq(aiActionDrafts.status, 'pending'),
        ),
      );
    audit(userId, draftId, actionCounts, 'execution_failed');
    throw new DraftExecutionError('DRAFT_EXECUTION_FAILED');
  }
}
