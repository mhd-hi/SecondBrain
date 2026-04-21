import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

const assertUserOwnsCourseMock = vi.fn();
const getUserCourseTasksMock = vi.fn();

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

describe('tasks route cache headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertUserOwnsCourseMock.mockResolvedValue(undefined);
    getUserCourseTasksMock.mockResolvedValue([]);
  });

  it('returns no-store cache headers for course task lists', async () => {
    const { GET } = await import('@/app/api/tasks/route');
    const getRoute = GET as unknown as (
      request: Request,
      user: { id: string },
    ) => Promise<Response>;

    const response = await getRoute(
      new Request('http://localhost/api/tasks?courseId=course-1') as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate, max-age=0',
    );
    await expect(response.json()).resolves.toEqual([]);
    expect(assertUserOwnsCourseMock).toHaveBeenCalledWith('course-1', 'user-1');
    expect(getUserCourseTasksMock).toHaveBeenCalledWith('course-1', 'user-1');
  });
});
