// @vitest-environment node
// Node environment: happy-dom strips the fetch-forbidden `Origin` header.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api', () => ({
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock('@/lib/ai/chat/executor', () => ({
  DraftExecutionError: class DraftExecutionError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  executeDraft: vi.fn(),
  rejectDraft: vi.fn(),
  getAuthoritativeTasks: vi.fn(async () => []),
}));

vi.mock('@/lib/ai/chat/drafts', () => ({
  getOwnedDraft: vi.fn(async () => undefined),
  publicDraft: vi.fn(() => ({})),
}));

const { POST: approvePost } = await import(
  '@/app/api/ai/actions/[actionId]/approve/route'
);
const { POST: rejectPost } = await import(
  '@/app/api/ai/actions/[actionId]/reject/route'
);

const user = { id: 'user-1' };

function request(origin: string | null, actionId = 'draft-1'): Request {
  const headers = new Headers();
  if (origin) {
    headers.set('origin', origin);
  }
  return new Request(`http://localhost:3000/api/ai/actions/${actionId}/x`, {
    method: 'POST',
    headers,
  });
}

describe.each([
  ['approve', () => approvePost],
  ['reject', () => rejectPost],
])('%s route cross-origin protection (plan 21.8)', (name, getHandler) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a cross-origin Origin header with 403', async () => {
    const response = await getHandler()(
      request('https://evil.example.com') as never,
      { params: Promise.resolve({ actionId: 'draft-1' }), user } as never,
    );

    expect(response.status).toBe(403);
  });

  it('rejects a malformed Origin header with 403', async () => {
    const response = await getHandler()(
      request('not-a-url') as never,
      { params: Promise.resolve({ actionId: 'draft-1' }), user } as never,
    );

    expect(response.status).toBe(403);
  });

  it('allows a same-origin request through to the handler', async () => {
    const { executeDraft } = await import('@/lib/ai/chat/executor');
    vi.mocked(executeDraft).mockResolvedValueOnce({
      draft: null,
      tasks: [],
      receipt: undefined,
    } as never);
    const response = await getHandler()(
      request('http://localhost:3000') as never,
      { params: Promise.resolve({ actionId: 'draft-1' }), user } as never,
    );

    expect(response.status).not.toBe(403);
  });

  it('allows a missing Origin header (non-browser clients)', async () => {
    const { executeDraft } = await import('@/lib/ai/chat/executor');
    vi.mocked(executeDraft).mockResolvedValueOnce({
      draft: null,
      tasks: [],
      receipt: undefined,
    } as never);
    const response = await getHandler()(
      request(null) as never,
      { params: Promise.resolve({ actionId: 'draft-1' }), user } as never,
    );

    expect(response.status).not.toBe(403);
  });
});
