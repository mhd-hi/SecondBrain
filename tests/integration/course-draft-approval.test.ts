import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createDraft } from '@/lib/ai/chat/drafts';
import type { PreparedDraft } from '@/lib/ai/chat/drafts';
import {
  DraftExecutionError,
  executeDraft,
} from '@/lib/ai/chat/executor';
import { sha256Hex } from '@/lib/auth/mcp';
import { db, dbClient } from '@/server/db';
import {
  aiActionDrafts,
  courses,
  customLinks,
  mcpAuditEvents,
  mcpConnections,
  tasks,
  terms,
  users,
} from '@/server/db/schema';
import { StatusTask } from '@/types/status-task';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

// Valid-format but far-future term: no collision with real/app terms.
const TERM_ID = '20991';

const userIds = new Set<string>();
const connectionIds = new Set<string>();

async function seedUser() {
  const userId = randomUUID();
  userIds.add(userId);
  await db.insert(users).values({ id: userId, email: `${userId}@test.local` });
  return userId;
}

function coursePrepared(code: string, school: 'ets' | 'none' = 'none'): PreparedDraft {
  return {
    payload: {
      payloadVersion: 2,
      actions: [
        {
          type: 'create_course',
          course: { code, name: code, term: TERM_ID, school, daypart: 'AM' },
          tasks: [
            {
              title: 'Intro task',
              dueDate: '2099-01-10',
              status: StatusTask.TODO,
              estimatedEffort: 2,
              actualEffort: 0,
              type: 'theorie',
            },
          ],
        },
      ],
    },
    taskVersions: {},
    reviewPayload: {
      summary: `Create ${code}`,
      counts: { adds: 0, updates: 0, deletes: 0, courses: 1 },
      items: [
        {
          type: 'create_course',
          title: code,
          courseCode: code,
          courseName: code,
          after: { code, term: TERM_ID },
          diff: { code: { after: code } },
          warnings: [],
          riskLevel: 'low',
        },
      ],
    },
  };
}

async function makeCourseDraft(userId: string, code: string, school: 'ets' | 'none' = 'none') {
  return createDraft({
    userId,
    requestId: randomUUID(),
    output: {
      kind: 'draft',
      message: 'Review',
      summary: `Create ${code}`,
      reason: 'integration test',
      actions: [
        {
          type: 'create_course',
          course: { code, term: TERM_ID, school, daypart: 'AM' },
          tasks: [],
        },
      ],
    },
    prepared: coursePrepared(code, school),
  });
}

afterEach(async () => {
  for (const connectionId of connectionIds) {
    await db.delete(mcpAuditEvents).where(eq(mcpAuditEvents.connectionId, connectionId));
    await db.delete(mcpConnections).where(eq(mcpConnections.id, connectionId));
  }
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId));
  }
  await db.delete(terms).where(eq(terms.id, TERM_ID));
  userIds.clear();
  connectionIds.clear();
});

afterAll(async () => {
  await dbClient.end();
});

describe('course draft execution (plan M3)', () => {
  it('creates course + tasks atomically on the web channel', async () => {
    const userId = await seedUser();
    const draft = await makeCourseDraft(userId, 'TST101');

    const result = await executeDraft(userId, draft.id);

    expect(result.draft.status).toBe('executed');

    const receipt = result.draft.executionReceipt as Record<string, unknown>;

    expect(receipt.receiptVersion).toBe(1);
    expect(receipt.approvalChannel).toBe('web');
    expect(typeof receipt.addedCourseId).toBe('string');

    const courseRows = await db.select().from(courses).where(eq(courses.id, receipt.addedCourseId as string));

    expect(courseRows[0]).toMatchObject({ code: 'TST101', term: TERM_ID, daypart: 'AM' });

    const taskRows = await db.select().from(tasks).where(eq(tasks.courseId, receipt.addedCourseId as string));

    expect(taskRows).toHaveLength(1);
    expect(taskRows[0]).toMatchObject({ title: 'Intro task' });

    // school=none → no PlanETS shortcut link.
    const linkRows = await db.select().from(customLinks).where(eq(customLinks.courseId, receipt.addedCourseId as string));

    expect(linkRows).toHaveLength(0);

    // Re-execution is a conflict, never a duplicate course.
    await expect(executeDraft(userId, draft.id)).rejects.toMatchObject({
      code: 'DRAFT_CONFLICT',
    });
  });

  it('creates the PlanETS shortcut link for ETS courses', async () => {
    const userId = await seedUser();
    const draft = await makeCourseDraft(userId, 'TST102', 'ets');

    const result = await executeDraft(userId, draft.id);
    const receipt = result.draft.executionReceipt as Record<string, unknown>;

    const linkRows = await db.select().from(customLinks).where(eq(customLinks.courseId, receipt.addedCourseId as string));

    expect(linkRows).toHaveLength(1);
    expect(linkRows[0]!.url).toContain('planets.etsmtl.ca');
    expect(linkRows[0]!.url).toContain('TST102');
  });

  it('marks stale with course_already_exists when the course appears after prepare', async () => {
    const userId = await seedUser();
    const draft = await makeCourseDraft(userId, 'TST103');

    // Simulate a concurrent UI create between prepare and approve.
    await db.insert(terms).values({ id: TERM_ID, label: 'Hiver 2099' }).onConflictDoNothing();
    await db.insert(courses).values({
      id: randomUUID(),
      userId,
      name: 'TST103',
      code: 'TST103',
      term: TERM_ID,
      color: 'blue',
      daypart: 'AM',
    });

    await expect(executeDraft(userId, draft.id)).rejects.toMatchObject({
      code: 'DRAFT_STALE',
    });

    const row = await db.select().from(aiActionDrafts).where(eq(aiActionDrafts.id, draft.id));

    expect(row[0]!.status).toBe('stale');
    expect(row[0]!.failureCode).toBe('course_already_exists');
  });

  it('commits course drafts on the MCP channel with audit', async () => {
    const userId = await seedUser();
    const connectionId = randomUUID();
    connectionIds.add(connectionId);
    // Explicit-column insert: works whether or not migration 0033 (API-key
    // columns) has been applied to the database under test.
    await db.execute(sql`
      INSERT INTO mcp_connections
        (id, user_id, oauth_issuer, oauth_subject, oauth_client_id, oauth_grant_id, client_name, scopes)
      VALUES
        (${connectionId}, ${userId}, 'https://issuer.test', ${userId}, 'client-a', ${`grant-${connectionId}`}, 'Test client', ${JSON.stringify(['secondbrain:read', 'secondbrain:write'])}::jsonb)
    `);

    const output = {
      kind: 'draft' as const,
      message: 'Review',
      summary: 'Create TST104',
      reason: 'integration test',
      actions: [
        {
          type: 'create_course' as const,
          course: { code: 'TST104', term: TERM_ID, school: 'none' as const, daypart: 'AM' as const },
          tasks: [],
        },
      ],
    };
    const draft = await createDraft({
      userId,
      requestId: randomUUID(),
      output,
      prepared: coursePrepared('TST104'),
      mcp: {
        connectionId,
        requestNamespace: `mcp:${connectionId}`,
        requestHash: sha256Hex(JSON.stringify(output.actions)),
      },
    });

    const capabilityRaw = 'course-capability-0123456789abcdef';
    await db
      .update(aiActionDrafts)
      .set({
        approvalCapabilityHash: sha256Hex(capabilityRaw),
        approvalCapabilityExpiresAt: new Date(Date.now() + 600_000),
      })
      .where(eq(aiActionDrafts.id, draft.id));

    const result = await executeDraft(userId, draft.id, {
      channel: 'mcp_app',
      connectionId,
      capabilityHash: sha256Hex(capabilityRaw),
    });

    expect(result.draft.status).toBe('executed');

    const receipt = result.draft.executionReceipt as Record<string, unknown>;

    expect(receipt.approvalChannel).toBe('mcp_app');
    expect(typeof receipt.addedCourseId).toBe('string');

    const auditRows = await db
      .select()
      .from(mcpAuditEvents)
      .where(eq(mcpAuditEvents.draftId, draft.id));

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.outcome).toBe('executed');

    // Wrong-connection commit still refused.
    const otherConnection = randomUUID();

    await expect(
      executeDraft(userId, draft.id, {
        channel: 'mcp_app',
        connectionId: otherConnection,
        capabilityHash: sha256Hex(capabilityRaw),
      }),
    ).rejects.toBeInstanceOf(DraftExecutionError);
  });
});
