import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockAuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

const authMock = vi.fn();
const assertUserOwnsCourseMock = vi.fn();
const captureExceptionMock = vi.fn();
const getUserCourseTasksMock = vi.fn();

vi.mock('@/server/auth', () => ({ auth: (...args: unknown[]) => authMock(...args) }));
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));
vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: MockAuthorizationError,
  withAuth: vi.fn((handler: (req: Request, context: unknown) => Promise<Response>) =>
    async (req: Request, context: unknown) => {
      try {
        return await handler(req, context);
      } catch (error) {
        if (error instanceof Error && error.name === 'AuthorizationError') {
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
        if (error instanceof Error && error.name === 'AuthorizationError') {
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe('task route authorization', () => {
  it('returns 403 for course task lists when the course is not owned by the authenticated user', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertUserOwnsCourseMock.mockRejectedValue(new MockAuthorizationError('Course not found'));
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

});
