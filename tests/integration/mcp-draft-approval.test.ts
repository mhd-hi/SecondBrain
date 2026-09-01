import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createDraft, prepareDraft } from '@/lib/ai/chat/drafts';
import {
  DraftExecutionError,
  executeDraft,
  rejectDraft,
} from '@/lib/ai/chat/executor';
import { plannerOutputSchema } from '@/lib/ai/chat/types';
import { sha256Hex } from '@/lib/auth/mcp';
import { db, dbClient } from '@/server/db';
import {
  aiActionDrafts,
  courses,
  mcpAuditEvents,
  mcpConnections,
  tasks,
  terms,
  users,
} from '@/server/db/schema';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

const userIds = new Set<string>();
const termIds = new Set<string>();
const connectionIds = new Set<string>();

async function seedOwner() {
  const userId = randomUUID();
  const termId = String(Math.floor(10000 + Math.random() * 89999));
  const courseId = randomUUID();
  const taskId = randomUUID();
  const connectionId = randomUUID();
  userIds.add(userId);
  termIds.add(termId);
  connectionIds.add(connectionId);
  await db.insert(terms).values({ id: termId, label: 'MCP integration' });
  await db.insert(users).values({ id: userId, email: `${userId}@test.local` });
  await db.insert(mcpConnections).values({
    id: connectionId,
    userId,
    oauthIssuer: 'https://issuer.test',
    oauthSubject: userId,
    oauthClientId: 'client-a',
    oauthGrantId: `grant-${connectionId}`,
    clientName: 'Test client',
    scopes: ['secondbrain:read', 'secondbrain:write'],
  });
  await db.insert(courses).values({
    id: courseId,
    userId,
    name: 'MCP integration',
    code: `MCP${termId}`,
    term: termId,
    color: 'blue',
    daypart: 'AM',
  });
  await db.insert(tasks).values({
    id: taskId,
    userId,
    courseId,
    title: 'Existing task',
    dueDate: new Date('2026-09-08T04:00:00.000Z'),
  });
  return { userId, courseId, taskId, connectionId };
}

async function makeMcpDraft({
  userId,
  connectionId,
  actions,
}: {
  userId: string;
  connectionId: string;
  actions: unknown[];
}) {
  const output = plannerOutputSchema.parse({
    kind: 'draft',
    message: 'Review',
    summary: 'MCP changes',
    reason: 'MCP integration test',
    actions,
  });
  if (output.kind !== 'draft') {
    throw new Error('Expected draft');
  }
  return createDraft({
    userId,
    requestId: randomUUID(),
    output,
    prepared: await prepareDraft(userId, output),
    mcp: {
      connectionId,
      requestNamespace: `mcp:${connectionId}`,
      requestHash: sha256Hex(JSON.stringify(actions)),
    },
  });
}

afterEach(async () => {
  for (const connectionId of connectionIds) {
    await db
      .delete(mcpAuditEvents)
      .where(eq(mcpAuditEvents.connectionId, connectionId));
    await db
      .delete(mcpConnections)
      .where(eq(mcpConnections.id, connectionId));
  }
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId));
  }
  for (const termId of termIds) {
    await db.delete(terms).where(eq(terms.id, termId));
  }
  userIds.clear();
  termIds.clear();
  connectionIds.clear();
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, 'cascade-mcp@test.local'));
  await db.delete(terms).where(eq(terms.label, 'cascade-mcp'));
  await dbClient.end();
});

describe('MCP draft approval lifecycle (plan 21.5/21.6)', () => {
  it('commits with a valid capability exactly once and records receipt plus audit', async () => {
    const owner = await seedOwner();
    const draft = await makeMcpDraft({
      userId: owner.userId,
      connectionId: owner.connectionId,
      actions: [
        {
          type: 'update_task',
          taskId: owner.taskId,
          changes: { title: 'Committed title' },
        },
      ],
    });

    const capabilityRaw = 'capability-raw-value-0123456789abcdef';
    const now = new Date();
    await db
      .update(aiActionDrafts)
      .set({
        approvalCapabilityHash: sha256Hex(capabilityRaw),
        approvalCapabilityExpiresAt: new Date(now.getTime() + 600_000),
      })
      .where(eq(aiActionDrafts.id, draft.id));

    const result = await executeDraft(owner.userId, draft.id, {
      channel: 'mcp_app',
      connectionId: owner.connectionId,
      grantId: `grant-${owner.connectionId}`,
      capabilityHash: sha256Hex(capabilityRaw),
    });

    expect(result.draft.status).toBe('executed');

    const receipt = result.draft.executionReceipt as Record<string, unknown>;

    expect(receipt.receiptVersion).toBe(1);
    expect(receipt.approvalChannel).toBe('mcp_app');
    expect(receipt.connectionId).toBe(owner.connectionId);
    expect(receipt.addedTaskIds).toEqual([]);
    expect(receipt.deletedTaskIds).toEqual([]);
    expect((receipt.updatedTaskIds as string[])).toContain(owner.taskId);
    expect(receipt.executedAt).toBeTruthy();
    expect(result.draft.approvalCapabilityConsumedAt).toBeTruthy();
    expect(result.draft.terminalAt).toBeTruthy();

    const auditRows = await db
      .select()
      .from(mcpAuditEvents)
      .where(eq(mcpAuditEvents.draftId, draft.id));

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.outcome).toBe('executed');
    expect(auditRows[0]!.toolName).toBe('commit_task_changes');

    // Capability replay returns receipt state, never re-executes: the draft
    // is terminal, so a second commit fails with DRAFT_CONFLICT family.
    await expect(
      executeDraft(owner.userId, draft.id, {
        channel: 'mcp_app',
        connectionId: owner.connectionId,
        grantId: `grant-${owner.connectionId}`,
        capabilityHash: sha256Hex(capabilityRaw),
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
  });

  it('rejects a wrong capability without consuming or mutating', async () => {
    const owner = await seedOwner();
    const draft = await makeMcpDraft({
      userId: owner.userId,
      connectionId: owner.connectionId,
      actions: [
        {
          type: 'update_task',
          taskId: owner.taskId,
          changes: { title: 'Should not apply' },
        },
      ],
    });
    await db
      .update(aiActionDrafts)
      .set({
        approvalCapabilityHash: sha256Hex('correct-capability-0123456789'),
        approvalCapabilityExpiresAt: new Date(Date.now() + 600_000),
      })
      .where(eq(aiActionDrafts.id, draft.id));

    await expect(
      executeDraft(owner.userId, draft.id, {
        channel: 'mcp_app',
        connectionId: owner.connectionId,
        grantId: `grant-${owner.connectionId}`,
        capabilityHash: sha256Hex('wrong-capability-9876543210'),
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_CAPABILITY_MISMATCH' });

    const untouched = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, owner.taskId));

    expect(untouched[0]!.title).toBe('Existing task');

    const row = await db
      .select()
      .from(aiActionDrafts)
      .where(eq(aiActionDrafts.id, draft.id));

    expect(row[0]!.status).toBe('pending');
    expect(row[0]!.approvalCapabilityConsumedAt).toBeNull();
  });

  it('rejects an expired capability', async () => {
    const owner = await seedOwner();
    const draft = await makeMcpDraft({
      userId: owner.userId,
      connectionId: owner.connectionId,
      actions: [
        {
          type: 'update_task',
          taskId: owner.taskId,
          changes: { title: 'Expired path' },
        },
      ],
    });
    await db
      .update(aiActionDrafts)
      .set({
        approvalCapabilityHash: sha256Hex('expired-capability-0123456789'),
        approvalCapabilityExpiresAt: new Date(Date.now() - 1_000),
      })
      .where(eq(aiActionDrafts.id, draft.id));

    await expect(
      executeDraft(owner.userId, draft.id, {
        channel: 'mcp_app',
        connectionId: owner.connectionId,
        grantId: `grant-${owner.connectionId}`,
        capabilityHash: sha256Hex('expired-capability-0123456789'),
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_CAPABILITY_EXPIRED' });
  });

  it('refuses a commit from a different connection', async () => {
    const owner = await seedOwner();
    const other = await seedOwner();
    const draft = await makeMcpDraft({
      userId: owner.userId,
      connectionId: owner.connectionId,
      actions: [
        {
          type: 'update_task',
          taskId: owner.taskId,
          changes: { title: 'Cross-connection' },
        },
      ],
    });
    await db
      .update(aiActionDrafts)
      .set({
        approvalCapabilityHash: sha256Hex('capability-abc-0123456789def'),
        approvalCapabilityExpiresAt: new Date(Date.now() + 600_000),
      })
      .where(eq(aiActionDrafts.id, draft.id));

    await expect(
      executeDraft(owner.userId, draft.id, {
        channel: 'mcp_app',
        connectionId: other.connectionId,
        grantId: `grant-${other.connectionId}`,
        capabilityHash: sha256Hex('capability-abc-0123456789def'),
      }),
    ).rejects.toBeInstanceOf(DraftExecutionError);
  });

  it('rejects via app-only path atomically with audit', async () => {
    const owner = await seedOwner();
    const draft = await makeMcpDraft({
      userId: owner.userId,
      connectionId: owner.connectionId,
      actions: [
        {
          type: 'update_task',
          taskId: owner.taskId,
          changes: { title: 'Will be rejected' },
        },
      ],
    });
    const capabilityRaw = 'reject-capability-0123456789abcdef';
    await db
      .update(aiActionDrafts)
      .set({
        approvalCapabilityHash: sha256Hex(capabilityRaw),
        approvalCapabilityExpiresAt: new Date(Date.now() + 600_000),
      })
      .where(eq(aiActionDrafts.id, draft.id));

    const rejected = await rejectDraft(owner.userId, draft.id, {
      channel: 'mcp_app',
      connectionId: owner.connectionId,
      grantId: `grant-${owner.connectionId}`,
      capabilityHash: sha256Hex(capabilityRaw),
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.terminalAt).toBeTruthy();

    const auditRows = await db
      .select()
      .from(mcpAuditEvents)
      .where(eq(mcpAuditEvents.draftId, draft.id));

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.outcome).toBe('rejected');

    // Capability consumed: a second reject with the same capability fails.
    await expect(
      rejectDraft(owner.userId, draft.id, {
        channel: 'mcp_app',
        connectionId: owner.connectionId,
        grantId: `grant-${owner.connectionId}`,
        capabilityHash: sha256Hex(capabilityRaw),
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_CAPABILITY_CONSUMED' });
  });

  it('preserves the browser channel: no capability required, browser shape kept', async () => {
    const owner = await seedOwner();
    const draft = await makeMcpDraft({
      userId: owner.userId,
      connectionId: owner.connectionId,
      actions: [
        {
          type: 'update_task',
          taskId: owner.taskId,
          changes: { title: 'Browser committed' },
        },
      ],
    });
    const result = await executeDraft(owner.userId, draft.id);

    expect(result.draft.status).toBe('executed');
    expect(result.tasks).toBeInstanceOf(Array);
    expect(
      result.tasks.find((task) => task.id === owner.taskId)?.title,
    ).toBe('Browser committed');

    const receipt = result.draft.executionReceipt as Record<string, unknown>;

    expect(receipt.approvalChannel).toBe('web');
    expect(receipt.connectionId).toBeNull();
  });

  it('marks stale drafts terminal without mutating tasks (mcp channel)', async () => {
    const owner = await seedOwner();
    const draft = await makeMcpDraft({
      userId: owner.userId,
      connectionId: owner.connectionId,
      actions: [
        {
          type: 'update_task',
          taskId: owner.taskId,
          changes: { title: 'Stale path' },
        },
      ],
    });
    const capabilityRaw = 'stale-capability-0123456789abcdef';
    await db
      .update(aiActionDrafts)
      .set({
        approvalCapabilityHash: sha256Hex(capabilityRaw),
        approvalCapabilityExpiresAt: new Date(Date.now() + 600_000),
      })
      .where(eq(aiActionDrafts.id, draft.id));

    // Change the task after draft creation: version check must fail.
    await db
      .update(tasks)
      .set({ title: 'Changed underneath', updatedAt: new Date() })
      .where(eq(tasks.id, owner.taskId));

    await expect(
      executeDraft(owner.userId, draft.id, {
        channel: 'mcp_app',
        connectionId: owner.connectionId,
        grantId: `grant-${owner.connectionId}`,
        capabilityHash: sha256Hex(capabilityRaw),
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_STALE' });

    const row = await db
      .select()
      .from(aiActionDrafts)
      .where(eq(aiActionDrafts.id, draft.id));

    expect(row[0]!.status).toBe('stale');
    expect(row[0]!.terminalAt).toBeTruthy();

    const task = await db.select().from(tasks).where(eq(tasks.id, owner.taskId));

    expect(task[0]!.title).toBe('Changed underneath');
  });
});
