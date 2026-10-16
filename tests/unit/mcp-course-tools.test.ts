// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDraftMock = vi.fn();
const findDraftMock = vi.fn();
const prepareDraftMock = vi.fn();

vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/db/schema', () => ({}));
vi.mock('@/lib/auth/db', () => ({
  createUserTaskWithExecutor: vi.fn(),
  deleteUserTaskWithExecutor: vi.fn(),
  updateUserTaskWithExecutor: vi.fn(),
  assertUserOwnsCourse: vi.fn(),
}));
vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));
vi.mock('@/lib/auth/mcp', () => ({
  requireScopes: vi.fn(),
  sha256Hex: (value: string) => `hash-${value}`,
}));
vi.mock('@/lib/ai/chat/drafts', () => ({
  DraftValidationError: class DraftValidationError extends Error {},
  createDraft: createDraftMock,
  findDraftByNamespacedRequest: findDraftMock,
  getOwnedDraft: vi.fn(),
  prepareDraft: prepareDraftMock,
}));

const { createMcpServer } = await import('@/lib/mcp/server');

const context = {
  userId: 'user-1',
  connectionId: 'conn-1',
  clientId: 'client-1',
  grantId: 'grant-1',
  issuer: 'https://issuer.test',
  scopes: ['secondbrain:read', 'secondbrain:write'],
};

type Handler = (
  args: Record<string, unknown>,
  extra?: unknown,
) => Promise<{
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}>;

function handlerFor(server: unknown): Handler {
  const tools = (
    server as unknown as {
      _registeredTools?: Record<string, { handler: Handler }>;
    }
  )._registeredTools;
  const handler = tools?.prepare_course_creation?.handler;
  if (!handler) {
    throw new Error('prepare_course_creation not registered');
  }
  return handler;
}

const validArgs = {
  requestId: '11111111-1111-4111-8111-111111111111',
  summary: 'Create PHY335 Automne 2026',
  reason: 'User asked for a new ETS course',
  courseCode: 'phy335',
  term: '20263',
  school: 'ets',
};

const ownedDraft = {
  id: '22222222-2222-4222-8222-222222222222',
  summary: 'Create PHY335 Automne 2026',
  reason: 'User asked',
  status: 'pending',
  reviewPayload: {
    summary: 'Create PHY335',
    counts: { adds: 0, updates: 0, deletes: 0, courses: 1 },
    items: [],
  },
  expiresAt: new Date(Date.now() + 86_400_000),
};

beforeEach(() => {
  createDraftMock.mockReset();
  findDraftMock.mockReset().mockResolvedValue(undefined);
  prepareDraftMock.mockReset().mockResolvedValue({
    payload: { payloadVersion: 2, actions: [] },
    taskVersions: {},
    reviewPayload: ownedDraft.reviewPayload,
  });
  createDraftMock.mockResolvedValue(ownedDraft);
});

describe('prepare_course_creation handler', () => {
  it('prepares a draft and fails closed without the UI extension', async () => {
    const handler = handlerFor(createMcpServer(context));
    const result = await handler({ ...validArgs }, { _meta: {} });

    expect(result.isError).toBeUndefined();
    expect(prepareDraftMock).toHaveBeenCalledOnce();

    const preparedOutput = prepareDraftMock.mock.calls[0]?.[1] as {
      actions: Array<{ type: string; course: Record<string, unknown> }>;
    };

    expect(preparedOutput.actions[0]?.type).toBe('create_course');
    // Model identity passes through; tasks are server-filled at prepare.
    expect(createDraftMock).toHaveBeenCalledOnce();
    // Fail closed: review text + web URL, no capability in _meta.
    expect(result._meta).toBeUndefined();

    const body = JSON.parse(result.content[0]?.text ?? '{}') as {
      draftId?: string;
      webReviewUrl?: string;
    };

    expect(body.draftId).toBe(ownedDraft.id);
    expect(body.webReviewUrl).toContain(`/mcp/review/${ownedDraft.id}`);
  });

  it('does not issue an approval capability when a client self-asserts MCP Apps', async () => {
    const handler = handlerFor(createMcpServer(context));
    const result = await handler(
      { ...validArgs },
      { _meta: { extensions: { 'io.modelcontextprotocol/ui': {} } } },
    );

    expect(result._meta).toBeUndefined();
    expect(result.content[0]?.text).toContain('webReviewUrl');
  });

  it('rejects bad terms and schools before touching the database', async () => {
    const handler = handlerFor(createMcpServer(context));

    const badTerm = await handler({ ...validArgs, term: 'H2025' }, { _meta: {} });

    expect(badTerm.isError).toBe(true);
    expect(badTerm.content[0]?.text).toContain('INVALID_INPUT');

    const badSchool = await handler(
      { ...validArgs, school: 'mcgill' },
      { _meta: {} },
    );

    expect(badSchool.isError).toBe(true);

    expect(findDraftMock).not.toHaveBeenCalled();
    expect(prepareDraftMock).not.toHaveBeenCalled();
  });

  it('returns IDEMPOTENCY_CONFLICT when the request ID is reused with different input', async () => {
    findDraftMock.mockResolvedValueOnce({
      ...ownedDraft,
      requestHash: 'hash-something-else-entirely',
    });
    const handler = handlerFor(createMcpServer(context));
    const result = await handler({ ...validArgs }, { _meta: {} });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('IDEMPOTENCY_CONFLICT');
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it('replays the same draft when the request ID is retried with identical input', async () => {
    const handler = handlerFor(createMcpServer(context));
    const first = await handler({ ...validArgs }, { _meta: {} });

    expect(first.isError).toBeUndefined();
    expect(createDraftMock).toHaveBeenCalledOnce();

    // Capture the hash the handler stored, then retry identically: the
    // existing draft must be replayed without creating a second one.
    const storedHash = (createDraftMock.mock.calls[0]?.[0] as {
      mcp: { requestHash: string };
    }).mcp.requestHash;
    findDraftMock.mockReset().mockResolvedValue({ ...ownedDraft, requestHash: storedHash });

    const second = await handler({ ...validArgs }, { _meta: {} });

    expect(second.isError).toBeUndefined();
    expect(createDraftMock).toHaveBeenCalledOnce();
    expect(prepareDraftMock).toHaveBeenCalledOnce();
    expect(JSON.parse(second.content[0]?.text ?? '{}')).toMatchObject({
      draftId: ownedDraft.id,
    });
  });
});
