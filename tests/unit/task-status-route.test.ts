import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

describe('task status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when status is missing', async () => {
    const { PATCH } = await import('@/app/api/tasks/[taskId]/status/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks/task-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Status is required' });
  });
});
