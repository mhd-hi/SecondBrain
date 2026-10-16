// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Minimal DB mock: none of these tests hit the database; they inspect
// registrations and tool metadata only.
vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/db/schema', () => ({}));
// Cut the executor -> auth/db -> auth/api -> next-auth module chain: these
// tests inspect tool registration metadata only, never the database layer.
vi.mock('@/lib/auth/db', () => ({
  createUserTaskWithExecutor: vi.fn(),
  deleteUserTaskWithExecutor: vi.fn(),
  updateUserTaskWithExecutor: vi.fn(),
  assertUserOwnsCourse: vi.fn(),
}));
vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));
// task-tools imports drafts -> db; server.ts imports ext-apps. The chain pulls
// nothing from next-auth, but the SDK import via @/lib/auth/mcp does not either.
// Mock the auth boundary to keep the module graph off next-auth.
vi.mock('@/lib/auth/mcp', () => ({
  requireScopes: vi.fn(),
  sha256Hex: (value: string) => `hash-${value}`,
}));

const { createMcpServer } = await import('@/lib/mcp/server');

type RegisteredTool = {
  description?: string;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
  inputSchema?: unknown;
};

function extractRegisteredTools(server: unknown): Map<string, RegisteredTool> {
  // The SDK McpServer keeps tool definitions in `_registeredTools` (plain
  // object keyed by name). Accessing it directly is the pragmatic way to
  // inspect registration metadata without a live transport.
  const raw = (server as unknown as {
    _registeredTools?: Record<string, RegisteredTool>;
  })._registeredTools;
  return new Map(Object.entries(raw ?? {}));
}

describe('MCP tool surface metadata (plan 19.1 / 21.4)', () => {
  const context = {
    userId: 'user-1',
    connectionId: 'conn-1',
    clientId: 'client-1',
    grantId: 'grant-1',
    issuer: 'https://issuer.test',
    scopes: ['secondbrain:read', 'secondbrain:write'],
  };

  const server = createMcpServer(context);
  const tools = extractRegisteredTools(server);

  it('registers read, prepare, and review tools only', () => {
    const names = new Set(tools.keys());
    for (const name of [
      'search_courses',
      'search_tasks',
      'get_task',
      'list_course_tasks',
      'resolve_course_week',
      'list_supported_schools',
      'list_terms',
      'prepare_task_changes',
      'prepare_course_creation',
      'render_task_review',
      'get_task_draft',
    ]) {
      expect(names.has(name), name).toBe(true);
    }

    expect(names.has('commit_task_changes')).toBe(false);
    expect(names.has('reject_task_changes')).toBe(false);
  });

  it('gives prepare_task_changes a self-describing discriminated action schema', () => {
    const schema = JSON.stringify(tools.get('prepare_task_changes')?.inputSchema ?? {});

    expect(schema).toContain('add_task');
    expect(schema).toContain('update_task');
    expect(schema).toContain('delete_task');
    expect(schema).toContain('courseId');
    expect(schema).toContain('dueDate');
  });

  it('marks read tools and get_task_draft with readOnlyHint', () => {
    for (const name of [
      'search_courses',
      'search_tasks',
      'get_task',
      'list_course_tasks',
      'resolve_course_week',
      'list_supported_schools',
      'list_terms',
      'get_task_draft',
    ]) {
      expect(tools.get(name)?.annotations?.readOnlyHint, name).toBe(true);
    }
  });

  it('gives prepare_course_creation a school- and term-constrained schema', () => {
    const schema = JSON.stringify(tools.get('prepare_course_creation')?.inputSchema ?? {});

    expect(schema).toContain('courseCode');
    expect(schema).toContain('school');
    expect(schema).toContain('term');
    expect(schema).toContain('ets');
    expect(schema).toContain('none');
    expect(tools.get('prepare_course_creation')?.annotations?.readOnlyHint).toBe(false);
    expect(tools.get('prepare_course_creation')?.annotations?.idempotentHint).toBe(true);
  });

});
