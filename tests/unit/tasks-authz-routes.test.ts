/* eslint-disable ts/no-explicit-any */
import type { Mock } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/lib/auth/api';
import { assertUserOwnsCourse, getUserCourseTasks } from '@/lib/auth/db';
import { updateStatusTask } from '@/lib/utils/task/queries';
import { auth } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/auth/db', () => ({
  assertUserOwnsCourse: vi.fn(),
  createUserTask: vi.fn(),
  deleteUserTask: vi.fn(),
  getUserCourseTasks: vi.fn(),
  updateUserTask: vi.fn(),
}));
vi.mock('@/lib/utils/task/queries', () => ({
  updateStatusTask: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('task route authorization', () => {
  it('returns 403 for course task lists when the course is not owned by the authenticated user', async () => {
    (auth as unknown as Mock).mockResolvedValue({ user: { id: 'user-1' } } as any);
    (assertUserOwnsCourse as unknown as Mock).mockRejectedValue(new AuthorizationError('Course not found'));
    const { GET } = await import('@/app/api/tasks/route');

    const response = await GET(
      new Request('http://localhost/api/tasks?courseId=foreign-course') as never,
      { params: Promise.resolve({}) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: 'UNAUTHORIZED',
      error: 'Course not found',
    });
    expect(getUserCourseTasks).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for task status updates when the task does not belong to the authenticated user', async () => {
    (auth as unknown as Mock).mockResolvedValue({ user: { id: 'user-1' } } as any);
    (updateStatusTask as unknown as Mock).mockRejectedValue(new AuthorizationError('Task not found or access denied'));
    const { PATCH } = await import('@/app/api/tasks/[taskId]/status/route');

    const response = await PATCH(
      new Request('http://localhost/api/tasks/task-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'TODO' }),
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: 'UNAUTHORIZED',
      error: 'Task not found or access denied',
    });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
