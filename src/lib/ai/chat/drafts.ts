import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { db } from '@/server/db';
import { aiActionDrafts, courses, tasks } from '@/server/db/schema';
import { formatTorontoDate, parseTorontoDueDate } from './date';
import { getRelatedTasks, MAX_PLANNER_NOTES_CHARACTERS } from './tools';
import {
  AI_DRAFT_PAYLOAD_VERSION,
  draftPayloadSchema,
  type PlannerOutput,
  type ReviewPayload,
  reviewPayloadSchema,
} from './types';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;

export class DraftValidationError extends Error {
  constructor() {
    super('Invalid draft targets');
    this.name = 'DraftValidationError';
  }
}

function counts(actions: Extract<PlannerOutput, { kind: 'draft' }>['actions']) {
  return {
    adds: actions.filter((action) => action.type === 'add_task').length,
    updates: actions.filter((action) => action.type === 'update_task').length,
    deletes: actions.filter((action) => action.type === 'delete_task').length,
  };
}

function taskSnapshot(task: typeof tasks.$inferSelect) {
  return {
    title: task.title,
    notes: task.notes ?? undefined,
    dueDate: formatTorontoDate(task.dueDate),
    status: task.status,
    type: task.type,
    estimatedEffort: task.estimatedEffort,
    actualEffort: task.actualEffort,
  };
}

function diffRecords(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
) {
  const diff: Record<string, { before?: unknown; after?: unknown }> = {};
  for (const key of new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])) {
    if (before?.[key] !== after?.[key]) {
      diff[key] = { before: before?.[key], after: after?.[key] };
    }
  }
  return diff;
}

export type PreparedDraft = {
  payload: {
    payloadVersion: typeof AI_DRAFT_PAYLOAD_VERSION;
    actions: Extract<PlannerOutput, { kind: 'draft' }>['actions'];
  };
  taskVersions: Record<string, string>;
  reviewPayload: ReviewPayload;
};

export async function prepareDraft(
  userId: string,
  output: Extract<PlannerOutput, { kind: 'draft' }>,
): Promise<PreparedDraft> {
  const existingTaskIds = output.actions
    .filter((action) => action.type !== 'add_task')
    .map((action) => action.taskId)
    .sort();
  const addCourseIds = [
    ...new Set(
      output.actions
        .filter((action) => action.type === 'add_task')
        .map((action) => action.courseId),
    ),
  ].sort();

  const [ownedTasks, ownedCourses, addCourseTasks] = await Promise.all([
    existingTaskIds.length
      ? db
          .select()
          .from(tasks)
          .where(
            and(eq(tasks.userId, userId), inArray(tasks.id, existingTaskIds)),
          )
          .orderBy(asc(tasks.id))
      : [],
    addCourseIds.length
      ? db
          .select()
          .from(courses)
          .where(
            and(eq(courses.userId, userId), inArray(courses.id, addCourseIds)),
          )
      : [],
    addCourseIds.length
      ? db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              inArray(tasks.courseId, addCourseIds),
            ),
          )
      : [],
  ]);

  if (
    ownedTasks.length !== existingTaskIds.length ||
    ownedCourses.length !== addCourseIds.length
  ) {
    throw new DraftValidationError();
  }

  const tasksById = new Map(ownedTasks.map((task) => [task.id, task]));
  const taskVersions = Object.fromEntries(
    ownedTasks.map((task) => [task.id, task.updatedAt.toISOString()]),
  );
  const related = new Map<
    string,
    Awaited<ReturnType<typeof getRelatedTasks>>
  >();
  for (const taskId of existingTaskIds) {
    related.set(
      taskId,
      await getRelatedTasks(userId, taskId, {
        remaining: MAX_PLANNER_NOTES_CHARACTERS,
      }),
    );
  }

  const items: ReviewPayload['items'] = output.actions.map((action) => {
    if (action.type === 'add_task') {
      const dueDate = parseTorontoDueDate(action.task.dueDate);
      const title = action.task.title.toLocaleLowerCase();
      const duplicates = addCourseTasks.filter((task) => {
        const candidate = task.title.toLocaleLowerCase();
        return (
          task.courseId === action.courseId &&
          (candidate.includes(title) || title.includes(candidate)) &&
          Math.abs(task.dueDate.getTime() - dueDate.getTime()) <=
            14 * 24 * 60 * 60 * 1_000
        );
      });
      const after = { ...action.task };
      return {
        type: 'add' as const,
        courseId: action.courseId,
        title: action.task.title,
        after,
        diff: diffRecords(undefined, after),
        warnings: duplicates.map(
          (duplicate) =>
            `Possible duplicate: ${duplicate.title} (${formatTorontoDate(duplicate.dueDate)})`,
        ),
        riskLevel: duplicates.length ? ('medium' as const) : ('low' as const),
      };
    }

    const task = tasksById.get(action.taskId)!;
    const before = taskSnapshot(task);
    const warnings = (related.get(task.id) ?? []).map(
      (neighbor) =>
        `Related task: ${neighbor.title} (${formatTorontoDate(neighbor.dueDate)})`,
    );
    if (action.type === 'delete_task') {
      return {
        type: 'delete' as const,
        taskId: task.id,
        courseId: task.courseId,
        title: task.title,
        before,
        diff: diffRecords(before, undefined),
        warnings,
        riskLevel: 'high' as const,
      };
    }

    const after = { ...before, ...action.changes };
    return {
      type: 'update' as const,
      taskId: task.id,
      courseId: task.courseId,
      title: action.changes.title ?? task.title,
      before,
      after,
      diff: diffRecords(before, after),
      warnings,
      riskLevel:
        'dueDate' in action.changes || warnings.length > 0
          ? ('medium' as const)
          : ('low' as const),
    };
  });

  return {
    payload: {
      payloadVersion: AI_DRAFT_PAYLOAD_VERSION,
      actions: output.actions,
    },
    taskVersions,
    reviewPayload: reviewPayloadSchema.parse({
      summary: output.summary,
      counts: counts(output.actions),
      items,
    }),
  };
}

export async function findDraftByRequest(userId: string, requestId: string) {
  return db
    .select()
    .from(aiActionDrafts)
    .where(
      and(
        eq(aiActionDrafts.userId, userId),
        eq(aiActionDrafts.requestId, requestId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function createDraft({
  userId,
  requestId,
  output,
  prepared,
}: {
  userId: string;
  requestId: string;
  output: Extract<PlannerOutput, { kind: 'draft' }>;
  prepared: PreparedDraft;
}) {
  const createdAt = new Date();
  const inserted = await db
    .insert(aiActionDrafts)
    .values({
      requestId,
      userId,
      summary: output.summary,
      reason: output.reason,
      payload: prepared.payload,
      taskVersions: prepared.taskVersions,
      reviewPayload: prepared.reviewPayload,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + DRAFT_TTL_MS),
    })
    .onConflictDoNothing({
      target: [aiActionDrafts.userId, aiActionDrafts.requestId],
    })
    .returning();
  const draft = inserted[0] ?? (await findDraftByRequest(userId, requestId));
  if (!draft) {
    throw new Error('Draft could not be created');
  }
  if (inserted[0]) {
    console.info('AI action draft event', {
      userId,
      draftId: draft.id,
      actionCounts: prepared.reviewPayload.counts,
      status: 'created',
    });
  }
  return draft;
}

export async function expireOwnedDraft(userId: string, draftId: string) {
  await db
    .update(aiActionDrafts)
    .set({ status: 'expired' })
    .where(
      and(
        eq(aiActionDrafts.id, draftId),
        eq(aiActionDrafts.userId, userId),
        eq(aiActionDrafts.status, 'pending'),
        lte(aiActionDrafts.expiresAt, new Date()),
      ),
    );
}

export async function getOwnedDraft(userId: string, draftId: string) {
  await expireOwnedDraft(userId, draftId);
  let draft = await db
    .select()
    .from(aiActionDrafts)
    .where(
      and(eq(aiActionDrafts.id, draftId), eq(aiActionDrafts.userId, userId)),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!draft) {
    return undefined;
  }

  if (
    draft.status === 'pending' &&
    !draftPayloadSchema.safeParse(draft.payload).success
  ) {
    await db
      .update(aiActionDrafts)
      .set({
        status: 'failed',
        failureCode: 'unsupported_payload_version',
      })
      .where(
        and(
          eq(aiActionDrafts.id, draftId),
          eq(aiActionDrafts.userId, userId),
          eq(aiActionDrafts.status, 'pending'),
        ),
      );
    draft = await db
      .select()
      .from(aiActionDrafts)
      .where(
        and(eq(aiActionDrafts.id, draftId), eq(aiActionDrafts.userId, userId)),
      )
      .limit(1)
      .then((rows) => rows[0]);
  }
  return draft;
}

export function publicDraft(
  draft: NonNullable<Awaited<ReturnType<typeof getOwnedDraft>>>,
) {
  return {
    id: draft.id,
    requestId: draft.requestId,
    status: draft.status,
    summary: draft.summary,
    reason: draft.reason,
    reviewPayload: reviewPayloadSchema.parse(draft.reviewPayload),
    failureCode: draft.failureCode,
    createdAt: draft.createdAt,
    expiresAt: draft.expiresAt,
  };
}
