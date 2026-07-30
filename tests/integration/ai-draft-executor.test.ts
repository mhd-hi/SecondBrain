import { randomUUID } from 'node:crypto';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDraft,
  getOwnedDraft,
  prepareDraft,
} from '@/lib/ai/chat/drafts';
import {
  executeDraft,
  rejectDraft,
} from '@/lib/ai/chat/executor';
import { parseTorontoDueDate } from '@/lib/ai/chat/date';
import { plannerOutputSchema } from '@/lib/ai/chat/types';
import { db, dbClient } from '@/server/db';
import {
  aiActionDrafts,
  courses,
  tasks,
  terms,
  users,
} from '@/server/db/schema';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

const userIds = new Set<string>();
const termIds = new Set<string>();

async function seedOwner() {
  const userId = randomUUID();
  const termId = String(Math.floor(10000 + Math.random() * 89999));
  const courseId = randomUUID();
  const taskId = randomUUID();
  userIds.add(userId);
  termIds.add(termId);
  await db.insert(terms).values({ id: termId, label: 'AI integration' });
  await db.insert(users).values({ id: userId, email: `${userId}@test.local` });
  await db.insert(courses).values({
    id: courseId,
    userId,
    name: 'AI integration',
    code: `AI${termId}`,
    term: termId,
    color: 'blue',
    daypart: 'AM',
  });
  await db.insert(tasks).values({
    id: taskId,
    userId,
    courseId,
    title: 'Existing task',
    dueDate: parseTorontoDueDate('2026-09-08'),
  });
  return { userId, courseId, taskId };
}

async function makeDraft({
  userId,
  requestId = randomUUID(),
  actions,
}: {
  userId: string;
  requestId?: string;
  actions: unknown[];
}) {
  const output = plannerOutputSchema.parse({
    kind: 'draft',
    message: 'Review',
    summary: 'Test changes',
    reason: 'Integration test',
    actions,
  });
  if (output.kind !== 'draft') {
    throw new Error('Expected draft output');
  }
  return createDraft({
    userId,
    requestId,
    output,
    prepared: await prepareDraft(userId, output),
  });
}

afterEach(async () => {
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId));
  }
  for (const termId of termIds) {
    await db.delete(terms).where(eq(terms.id, termId));
  }
  userIds.clear();
  termIds.clear();
});

afterAll(async () => {
  await db.delete(users).where(ilike(users.email, '%@test.local'));
  await db.delete(terms).where(eq(terms.label, 'AI integration'));
  await dbClient.end();
});

describe('AI draft database contract', () => {
  it('enforces ownership, expiry, and payload versions', async () => {
    const owner = await seedOwner();
    const stranger = await seedOwner();
    const draft = await makeDraft({
      userId: owner.userId,
      actions: [{
        type: 'update_task',
        taskId: owner.taskId,
        changes: { title: 'Updated' },
      }],
    });

    await expect(
      executeDraft(stranger.userId, draft.id),
    ).rejects.toMatchObject({ code: 'DRAFT_NOT_FOUND' });

    await db
      .update(aiActionDrafts)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(aiActionDrafts.id, draft.id));

    await expect(executeDraft(owner.userId, draft.id)).rejects.toMatchObject({
      code: 'DRAFT_EXPIRED',
    });

    await expect(rejectDraft(owner.userId, draft.id)).rejects.toMatchObject({
      code: 'DRAFT_EXPIRED',
    });

    const unsupported = await makeDraft({
      userId: owner.userId,
      actions: [{ type: 'delete_task', taskId: owner.taskId }],
    });
    await db
      .update(aiActionDrafts)
      .set({ payload: { payloadVersion: 999, actions: [] } })
      .where(eq(aiActionDrafts.id, unsupported.id));

    await expect(
      getOwnedDraft(owner.userId, unsupported.id),
    ).resolves.toMatchObject({
      status: 'failed',
      failureCode: 'unsupported_payload_version',
    });
  });

  it('marks changed targets stale without applying the draft', async () => {
    const owner = await seedOwner();
    const draft = await makeDraft({
      userId: owner.userId,
      actions: [{
        type: 'update_task',
        taskId: owner.taskId,
        changes: { title: 'Draft title' },
      }],
    });
    await db
      .update(tasks)
      .set({
        title: 'Concurrent title',
        updatedAt: new Date(Date.now() + 1_000),
      })
      .where(eq(tasks.id, owner.taskId));

    await expect(executeDraft(owner.userId, draft.id)).rejects.toMatchObject({
      code: 'DRAFT_STALE',
    });
    await expect(getOwnedDraft(owner.userId, draft.id)).resolves.toMatchObject({
      status: 'stale',
    });
    await expect(
      db.select().from(tasks).where(eq(tasks.id, owner.taskId)),
    ).resolves.toEqual([
      expect.objectContaining({ title: 'Concurrent title' }),
    ]);
  });

  it('rolls back earlier mutations when a later mutation fails', async () => {
    const owner = await seedOwner();
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION test_ai_draft_failure() RETURNS trigger AS $$
      BEGIN
        IF NEW.title = 'Trigger rollback' THEN
          RAISE EXCEPTION 'forced integration failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.execute(sql`
      CREATE TRIGGER test_ai_draft_failure_trigger
      BEFORE UPDATE ON tasks
      FOR EACH ROW EXECUTE FUNCTION test_ai_draft_failure()
    `);
    try {
      const draft = await makeDraft({
        userId: owner.userId,
        actions: [
          {
            type: 'add_task',
            courseId: owner.courseId,
            task: { title: 'Must roll back', dueDate: '2026-09-09' },
          },
          {
            type: 'update_task',
            taskId: owner.taskId,
            changes: { title: 'Trigger rollback' },
          },
        ],
      });

      await expect(executeDraft(owner.userId, draft.id)).rejects.toMatchObject({
        code: 'DRAFT_EXECUTION_FAILED',
      });
      await expect(
        getOwnedDraft(owner.userId, draft.id),
      ).resolves.toMatchObject({ status: 'failed' });
      await expect(
        db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, owner.userId),
              eq(tasks.title, 'Must roll back'),
            ),
          ),
      ).resolves.toEqual([]);
    } finally {
      await db.execute(
        sql`DROP TRIGGER IF EXISTS test_ai_draft_failure_trigger ON tasks`,
      );
      await db.execute(sql`DROP FUNCTION IF EXISTS test_ai_draft_failure()`);
    }
  });

  it('commits exactly once across concurrent and repeated approvals', async () => {
    const owner = await seedOwner();
    const draft = await makeDraft({
      userId: owner.userId,
      actions: [{
        type: 'add_task',
        courseId: owner.courseId,
        task: { title: 'Created once', dueDate: '2026-09-09' },
      }],
    });

    const approvals = await Promise.allSettled([
      executeDraft(owner.userId, draft.id),
      executeDraft(owner.userId, draft.id),
    ]);

    expect(
      approvals.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);

    expect(
      approvals.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    await expect(executeDraft(owner.userId, draft.id)).rejects.toMatchObject({
      code: 'DRAFT_CONFLICT',
    });
    await expect(
      db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, owner.userId),
            eq(tasks.title, 'Created once'),
          ),
        ),
    ).resolves.toHaveLength(1);
  });

  it('allows only approval or rejection to win their race', async () => {
    const owner = await seedOwner();
    const draft = await makeDraft({
      userId: owner.userId,
      actions: [{
        type: 'add_task',
        courseId: owner.courseId,
        task: { title: 'Race task', dueDate: '2026-09-09' },
      }],
    });

    const outcomes = await Promise.allSettled([
      executeDraft(owner.userId, draft.id),
      rejectDraft(owner.userId, draft.id),
    ]);

    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);

    expect(['executed', 'rejected']).toContain(
      (await getOwnedDraft(owner.userId, draft.id))?.status,
    );
  });

  it('returns one draft for concurrent duplicate request IDs', async () => {
    const owner = await seedOwner();
    const requestId = randomUUID();
    const output = plannerOutputSchema.parse({
      kind: 'draft',
      message: 'Review',
      summary: 'Idempotent draft',
      reason: 'Integration test',
      actions: [{
        type: 'add_task',
        courseId: owner.courseId,
        task: { title: 'One draft', dueDate: '2026-09-09' },
      }],
    });
    if (output.kind !== 'draft') {
      throw new Error('Expected draft output');
    }
    const prepared = await prepareDraft(owner.userId, output);

    const created = await Promise.all([
      createDraft({ userId: owner.userId, requestId, output, prepared }),
      createDraft({ userId: owner.userId, requestId, output, prepared }),
    ]);

    expect(new Set(created.map((draft) => draft.id))).toHaveLength(1);

    await expect(
      db
        .select()
        .from(aiActionDrafts)
        .where(
          and(
            eq(aiActionDrafts.userId, owner.userId),
            eq(aiActionDrafts.requestId, requestId),
          ),
        ),
    ).resolves.toHaveLength(1);
  });
});
