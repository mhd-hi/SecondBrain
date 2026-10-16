import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import {
  createUserCourseWithExecutor,
  createUserTaskWithExecutor,
  deleteUserTaskWithExecutor,
  updateUserTaskWithExecutor,
} from '@/lib/auth/db';
import { recordMcpAuditEvent } from '@/lib/auth/mcp';
import { ensureTermExistsWithExecutor } from '@/lib/courses/create-course-pipeline';
import { generateRandomCourseColor } from '@/lib/utils/colors-util';
import { buildPlanETSUrl } from '@/lib/utils/url-util';
import { db } from '@/server/db';
import { aiActionDrafts, courses, customLinks, tasks } from '@/server/db/schema';
import { LINK_TYPES } from '@/types/custom-link';
import { SCHOOL } from '@/types/school';
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
      | 'DRAFT_EXECUTION_FAILED'
      | 'DRAFT_CAPABILITY_MISMATCH'
      | 'DRAFT_CAPABILITY_EXPIRED'
      | 'DRAFT_CAPABILITY_CONSUMED',
  ) {
    super(code);
    this.name = 'DraftExecutionError';
  }
}

export type DraftApprovalContext =
  | { channel: 'web' }
  | {
      channel: 'mcp_app';
      connectionId: string;
      capabilityHash: string;
    };

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

export async function rejectDraft(
  userId: string,
  draftId: string,
  approval?: Extract<DraftApprovalContext, { channel: 'mcp_app' }>,
) {
  if (approval) {
    return rejectDraftWithCapability(userId, draftId, approval);
  }
  const rejected = await db.transaction(async (tx) => {
    const rows = await tx
      .update(aiActionDrafts)
      .set({ status: 'rejected', terminalAt: new Date() })
      .where(
        and(
          eq(aiActionDrafts.id, draftId),
          eq(aiActionDrafts.userId, userId),
          eq(aiActionDrafts.status, 'pending'),
          gt(aiActionDrafts.expiresAt, new Date()),
        ),
      )
      .returning();
    if (rows[0]?.source === 'mcp') {
      await recordMcpAuditEvent({
        userId,
        connectionId: rows[0].sourceConnectionId,
        toolName: 'web_reject_draft',
        draftId,
        outcome: 'rejected',
        correlationId: crypto.randomUUID(),
        tx,
      });
    }
    return rows;
  });
  if (!rejected[0]) {
    return classifyDraftState(userId, draftId);
  }
  const actionCounts = reviewPayloadSchema.parse(
    rejected[0].reviewPayload,
  ).counts;
  audit(userId, draftId, actionCounts, 'rejected');
  return rejected[0];
}

async function rejectDraftWithCapability(
  userId: string,
  draftId: string,
  approval: Extract<DraftApprovalContext, { channel: 'mcp_app' }>,
) {
  const now = new Date();
  const correlationId = crypto.randomUUID();
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .update(aiActionDrafts)
      .set({
        status: 'rejected',
        approvalCapabilityConsumedAt: now,
        approvalChannel: 'mcp_app',
        terminalAt: now,
      })
      .where(capabilityClaimPredicate(draftId, userId, approval, now))
      .returning();
    if (rows[0]) {
      await recordMcpAuditEvent({
        userId,
        connectionId: approval.connectionId,
        toolName: 'reject_task_changes',
        draftId,
        outcome: 'rejected',
        correlationId,
        tx,
      });
    }
    return rows[0];
  });
  if (!claimed) {
    return classifyCapabilityFailure(userId, draftId, approval);
  }
  const actionCounts = reviewPayloadSchema.parse(claimed.reviewPayload).counts;
  audit(userId, draftId, actionCounts, 'rejected');
  return claimed;
}

function capabilityClaimPredicate(
  draftId: string,
  userId: string,
  approval: Extract<DraftApprovalContext, { channel: 'mcp_app' }>,
  now: Date,
) {
  return and(
    eq(aiActionDrafts.id, draftId),
    eq(aiActionDrafts.userId, userId),
    eq(aiActionDrafts.status, 'pending'),
    gt(aiActionDrafts.expiresAt, now),
    eq(aiActionDrafts.source, 'mcp'),
    eq(aiActionDrafts.sourceConnectionId, approval.connectionId),
    eq(aiActionDrafts.approvalCapabilityHash, approval.capabilityHash),
    gt(aiActionDrafts.approvalCapabilityExpiresAt, now),
    isNull(aiActionDrafts.approvalCapabilityConsumedAt),
    // v1 (task-only) and v2 (task + create_course) payloads both execute;
    // getOwnedDraft already rejects unknown versions by marking failed.
    sql`${aiActionDrafts.payload}->>'payloadVersion' IN ('1', ${String(AI_DRAFT_PAYLOAD_VERSION)})`,
  );
}

async function classifyCapabilityFailure(
  userId: string,
  draftId: string,
  approval: Extract<DraftApprovalContext, { channel: 'mcp_app' }>,
): Promise<never> {
  const draft = await getOwnedDraft(userId, draftId);
  if (!draft) {
    throw new DraftExecutionError('DRAFT_NOT_FOUND');
  }
  if (draft.approvalCapabilityConsumedAt) {
    throw new DraftExecutionError('DRAFT_CAPABILITY_CONSUMED');
  }
  if (draft.status !== 'pending') {
    throw new DraftExecutionError('DRAFT_CONFLICT');
  }
  if (draft.approvalCapabilityHash !== approval.capabilityHash) {
    throw new DraftExecutionError('DRAFT_CAPABILITY_MISMATCH');
  }
  if (
    draft.approvalCapabilityExpiresAt &&
    draft.approvalCapabilityExpiresAt.getTime() <= Date.now()
  ) {
    throw new DraftExecutionError('DRAFT_CAPABILITY_EXPIRED');
  }
  throw new DraftExecutionError('DRAFT_CAPABILITY_MISMATCH');
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

class DraftStaleSignal extends Error {
  constructor() {
    super('Draft stale');
    this.name = 'DraftStaleSignal';
  }
}

// Course already exists at execute time (created via UI/another draft after
// prepare). Distinct from task-version staleness so the failure code tells
// the reviewer what changed.
class CourseExistsSignal extends DraftStaleSignal {
  constructor() {
    super();
    this.name = 'CourseExistsSignal';
  }
}

function isUniqueViolation(error: unknown): boolean {
  const wrapped = error as {
    code?: string;
    cause?: { code?: string };
  };
  const code = wrapped?.code ?? wrapped?.cause?.code;
  if (code === '23505') {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key|unique constraint/i.test(message);
}

type DraftExecutorTx = Parameters<typeof createUserTaskWithExecutor>[0] &
  Pick<typeof db, 'select' | 'execute'>;

async function executeCourseCreation(
  tx: DraftExecutorTx,
  userId: string,
  action: Extract<
    import('./types').DraftAction,
    { type: 'create_course' }
  >,
  addedTaskIds: string[],
  addedTaskSnapshots: Record<string, unknown>[],
): Promise<string> {
  const { course, tasks: courseTasks } = action;
  // FK guard inside the transaction: the term row must exist before the
  // course insert (courses.term references terms.id).
  await ensureTermExistsWithExecutor(tx, course.term);

  const existing = await tx
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.userId, userId),
        eq(courses.code, course.code),
        eq(courses.term, course.term),
      ),
    )
    .limit(1);
  if (existing[0]) {
    throw new CourseExistsSignal();
  }

  let created: typeof courses.$inferSelect;
  try {
    created = await createUserCourseWithExecutor(tx, userId, {
      code: course.code,
      name: course.name ?? course.code,
      term: course.term,
      daypart: course.daypart,
      color: generateRandomCourseColor(),
    });
  } catch (error) {
    // Unique race with a concurrent UI/API create after prepare.
    if (isUniqueViolation(error)) {
      throw new CourseExistsSignal();
    }
    throw error;
  }

  for (const task of courseTasks) {
    const inserted = await createUserTaskWithExecutor(tx, userId, {
      courseId: created.id,
      title: task.title,
      notes: task.notes,
      dueDate: parseTorontoDueDate(task.dueDate),
      status: task.status,
      type: task.type,
      estimatedEffort: task.estimatedEffort,
      actualEffort: task.actualEffort,
    });
    addedTaskIds.push(inserted.id);
    addedTaskSnapshots.push(taskSnapshotOf(inserted));
  }

  // Best-effort PlanETS shortcut, mirroring the UI flow. Never fails the draft.
  if (course.school === SCHOOL.ETS) {
    try {
      await tx.insert(customLinks).values({
        title: LINK_TYPES.PLANETS,
        url: buildPlanETSUrl(course.code, course.term),
        type: LINK_TYPES.PLANETS,
        userId,
        courseId: created.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to create PlanETS link:', error);
    }
  }

  return created.id;
}

function taskSnapshotOf(task: typeof tasks.$inferSelect) {
  return {
    id: task.id,
    courseId: task.courseId,
    title: task.title,
    notes: task.notes,
    type: task.type,
    status: task.status,
    estimatedEffort: task.estimatedEffort,
    actualEffort: task.actualEffort,
    dueDate: task.dueDate.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export type ExecutionReceipt = {
  receiptVersion: 1;
  draftId: string;
  approvalChannel: 'web' | 'mcp_app';
  connectionId: string | null;
  addedCourseId: string | null;
  addedTaskIds: string[];
  addedTaskSnapshots: Record<string, unknown>[];
  updatedTaskIds: string[];
  updatedTaskSnapshots: Record<string, unknown>[];
  deletedTaskIds: string[];
  executedAt: string;
};

export async function executeDraft(
  userId: string,
  draftId: string,
  approval: DraftApprovalContext = { channel: 'web' },
) {
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

  const isMcp = approval.channel === 'mcp_app';
  try {
    const result = await db.transaction(async (tx) => {
      const now = new Date();
      // Claim: for MCP the capability check is part of the claim predicate, so
      // owner, connection, hash, and both expirations are verified atomically
      // with the pending -> executing transition. One row lock serializes
      // concurrent commits: exactly one claim wins.
      const claimed = await tx
        .update(aiActionDrafts)
        .set(
          isMcp
            ? {
                status: 'executing' as const,
                approvalCapabilityConsumedAt: now,
                approvedAt: now,
                approvalChannel: 'mcp_app' as const,
              }
            : {
                status: 'executing' as const,
                approvedAt: now,
                approvalChannel: 'web' as const,
              },
        )
        .where(
          isMcp
            ? capabilityClaimPredicate(draftId, userId, approval, now)
            : and(
                eq(aiActionDrafts.id, draftId),
                eq(aiActionDrafts.userId, userId),
                eq(aiActionDrafts.status, 'pending'),
                gt(aiActionDrafts.expiresAt, now),
                sql`${aiActionDrafts.payload}->>'payloadVersion' IN ('1', ${String(AI_DRAFT_PAYLOAD_VERSION)})`,
              ),
        )
        .returning();
      if (!claimed[0]) {
        if (isMcp) {
          throw new DraftExecutionError('DRAFT_CAPABILITY_MISMATCH');
        }
        throw new DraftExecutionError('DRAFT_CONFLICT');
      }

      const payload = draftPayloadSchema.parse(claimed[0].payload);
      const taskVersions = new Map(
        Object.entries(claimed[0].taskVersions as Record<string, string>),
      );
      // Control-flow narrowing (not Array.filter guards): payload is a
      // v1|v2 union, and filter predicates over indexed union members do not
      // narrow reliably. Loops discriminate correctly on every version.
      const existingTaskIds: string[] = [];
      for (const action of payload.actions) {
        if (action.type === 'update_task' || action.type === 'delete_task') {
          existingTaskIds.push(action.taskId);
        }
      }
      existingTaskIds.sort();
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
        throw new DraftStaleSignal();
      }

      const addCourseIdSet = new Set<string>();
      for (const action of payload.actions) {
        if (action.type === 'add_task') {
          addCourseIdSet.add(action.courseId);
        }
      }
      const addCourseIds = [...addCourseIdSet].sort();
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
        throw new DraftStaleSignal();
      }

      const addedTaskIds: string[] = [];
      const addedTaskSnapshots: Record<string, unknown>[] = [];
      const updatedTaskIds: string[] = [];
      const updatedTaskSnapshots: Record<string, unknown>[] = [];
      const deletedTaskIds: string[] = [];
      let addedCourseId: string | null = null;
      for (const action of payload.actions) {
        if (action.type === 'create_course') {
          addedCourseId = await executeCourseCreation(
            tx,
            userId,
            action,
            addedTaskIds,
            addedTaskSnapshots,
          );
          continue;
        }
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
          addedTaskIds.push(inserted.id);
          addedTaskSnapshots.push(taskSnapshotOf(inserted));
          continue;
        }
        if (action.type === 'delete_task') {
          await deleteUserTaskWithExecutor(tx, action.taskId, userId);
          deletedTaskIds.push(action.taskId);
          continue;
        }

        const { dueDate, ...changes } = action.changes;
        const updated = await updateUserTaskWithExecutor(
          tx,
          action.taskId,
          userId,
          {
            ...changes,
            ...(dueDate && { dueDate: parseTorontoDueDate(dueDate) }),
          },
        );
        updatedTaskIds.push(updated.id);
        updatedTaskSnapshots.push(taskSnapshotOf(updated));
      }

      const executedAt = new Date();
      const receipt: ExecutionReceipt = {
        receiptVersion: 1,
        draftId,
        approvalChannel: isMcp ? 'mcp_app' : 'web',
        connectionId: isMcp ? approval.connectionId : null,
        addedCourseId,
        addedTaskIds,
        addedTaskSnapshots,
        updatedTaskIds,
        updatedTaskSnapshots,
        deletedTaskIds,
        executedAt: executedAt.toISOString(),
      };

      const executed = await tx
        .update(aiActionDrafts)
        .set({
          status: 'executed',
          terminalAt: executedAt,
          executionReceipt: receipt,
        })
        .where(
          and(
            eq(aiActionDrafts.id, draftId),
            eq(aiActionDrafts.userId, userId),
            eq(aiActionDrafts.status, 'executing'),
          ),
        )
        .returning();
      if (!executed[0]) {
        throw new DraftExecutionError('DRAFT_CONFLICT');
      }

      if (claimed[0].source === 'mcp') {
        // Durable audit event in the same transaction: a mutation must not
        // commit without its audit event (plan section 18).
        await recordMcpAuditEvent({
          userId,
          connectionId: isMcp ? approval.connectionId : claimed[0].sourceConnectionId,
          toolName: isMcp ? 'commit_task_changes' : 'web_approve_draft',
          draftId,
          outcome: 'executed',
          correlationId: crypto.randomUUID(),
          tx,
        });
      }

      const affectedIds = [...new Set([...existingTaskIds, ...addedTaskIds])];
      const authoritativeTasks = affectedIds.length
        ? await tx
            .select()
            .from(tasks)
            .where(
              and(eq(tasks.userId, userId), inArray(tasks.id, affectedIds)),
            )
            .orderBy(asc(tasks.id))
        : [];
      return { draft: executed[0], tasks: authoritativeTasks, receipt };
    });

    audit(userId, draftId, actionCounts, 'approved');
    audit(userId, draftId, actionCounts, 'execution_succeeded');
    return result;
  } catch (error) {
    if (error instanceof DraftStaleSignal) {
      await db
        .update(aiActionDrafts)
        .set({
          status: 'stale',
          failureCode:
            error instanceof CourseExistsSignal
              ? 'course_already_exists'
              : 'task_state_changed',
          terminalAt: new Date(),
        })
        .where(
          and(
            eq(aiActionDrafts.id, draftId),
            eq(aiActionDrafts.userId, userId),
            eq(aiActionDrafts.status, 'pending'),
          ),
        );
      audit(userId, draftId, actionCounts, 'stale');
      throw new DraftExecutionError('DRAFT_STALE');
    }
    if (error instanceof DraftExecutionError) {
      if (error.code === 'DRAFT_CONFLICT') {
        return classifyDraftState(userId, draftId);
      }
      if (error.code === 'DRAFT_CAPABILITY_MISMATCH' && isMcp) {
        await classifyCapabilityFailure(
          userId,
          draftId,
          approval as Extract<DraftApprovalContext, { channel: 'mcp_app' }>,
        );
      }
    }
    await db
      .update(aiActionDrafts)
      .set({
        status: 'failed',
        failureCode: 'execution_failed',
        terminalAt: new Date(),
      })
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
