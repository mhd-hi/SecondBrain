/* eslint-disable ts/no-explicit-any */
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/lib/auth/api';

const authMock = vi.fn();
const assertUserOwnsCourseMock = vi.fn();
const captureExceptionMock = vi.fn();
const getUserCourseTasksMock = vi.fn();
const updateStatusTaskMock = vi.fn();

vi.mock('@/server/auth', () => ({ auth: (...args: unknown[]) => authMock(...args) }));
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));
vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message = 'Access denied') {
      super(message);
      this.name = 'AuthorizationError';
    }
  },
  withAuth: vi.fn((handler: (req: Request, context: unknown) => Promise<Response>) =>
    async (req: Request, context: unknown) => {
      try {
        return await handler(req, context);
      } catch (error) {
        if (error instanceof AuthorizationError) {
          captureExceptionMock(error, {
            tags: { context: 'auth', function: 'withAuth' },
            extra: { route: req.url },
          });
          return Response.json(
            { code: 'UNAUTHORIZED', error: error.message },
            { status: 403 },
          );
        }
        throw error;
      }
    }),
  withAuthSimple: vi.fn((handler: (req: Request, user: unknown) => Promise<Response>) =>
    async (req: Request, user: unknown) => {
      try {
        return await handler(req, user);
      } catch (error) {
        if (error instanceof AuthorizationError) {
          captureExceptionMock(error, {
            tags: { context: 'auth', function: 'withAuth' },
            extra: { route: req.url },
          });
          return Response.json(
            { code: 'UNAUTHORIZED', error: error.message },
            { status: 403 },
          );
        }
        throw error;
      }
    }),
}));
vi.mock('@/lib/auth/db', () => ({
  assertUserOwnsCourse: (...args: unknown[]) => assertUserOwnsCourseMock(...args),
  createUserCourse: vi.fn(),
  createUserTask: vi.fn(),
  deleteUserCourse: vi.fn(),
  deleteUserTask: vi.fn(),
  getUserCourse: vi.fn(),
  getUserCourseSummaries: vi.fn(),
  getUserCourseTasks: (...args: unknown[]) => getUserCourseTasksMock(...args),
  getUserCourses: vi.fn(),
  getUserTask: vi.fn(),
  updateUserTask: vi.fn(),
}));
vi.mock('@/lib/utils/task/queries', () => ({
  updateStatusTask: (...args: unknown[]) => updateStatusTaskMock(...args),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('task route authorization', () => {
  it('returns 403 for course task lists when the course is not owned by the authenticated user', async () => {
    (authMock as unknown as Mock).mockResolvedValue({ user: { id: 'user-1' } } as any);
    assertUserOwnsCourseMock.mockRejectedValue(new AuthorizationError('Course not found'));
    const { GET } = await import('@/app/api/tasks/route');

    const response = await GET(
      new Request('http://localhost/api/tasks?courseId=foreign-course') as never,
      { id: 'user-1' } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: 'UNAUTHORIZED',
      error: 'Course not found',
    });
    expect(getUserCourseTasksMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for task status updates when the task does not belong to the authenticated user', async () => {
    (authMock as unknown as Mock).mockResolvedValue({ user: { id: 'user-1' } } as any);
    updateStatusTaskMock.mockRejectedValue(new AuthorizationError('Task not found or access denied'));
    const { PATCH } = await import('@/app/api/tasks/[taskId]/status/route');

    const response = await PATCH(
      new Request('http://localhost/api/tasks/task-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'TODO' }),
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: 'UNAUTHORIZED',
      error: 'Task not found or access denied',
    });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});
