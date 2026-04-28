import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusTask } from '@/types/status-task';

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

describe('task batch status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when taskIds is missing', async () => {
    const { PATCH } = await import('@/app/api/tasks/batch/status/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks/batch/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: StatusTask.COMPLETED }),
      }) as never,
      { user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'taskIds array is required and must not be empty',
    });
  });

  it('returns 400 when taskIds is empty', async () => {
    const { PATCH } = await import('@/app/api/tasks/batch/status/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks/batch/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [], status: StatusTask.COMPLETED }),
      }) as never,
      { user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'taskIds array is required and must not be empty',
    });
  });

  it('returns 400 when status is missing', async () => {
    const { PATCH } = await import('@/app/api/tasks/batch/status/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks/batch/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: ['task-1'] }),
      }) as never,
      { user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Status is required',
    });
  });
});
