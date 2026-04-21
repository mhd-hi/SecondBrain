import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api', () => ({
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

const getUserCourseTasksMock = vi.fn();

vi.mock('@/lib/auth/db', () => ({
  createUserTask: vi.fn(),
  deleteUserTask: vi.fn(),
  getUserCourse: vi.fn(),
  getUserCourseTasks: (...args: unknown[]) => getUserCourseTasksMock(...args),
  updateUserTask: vi.fn(),
}));

describe('tasks route cache headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserCourseTasksMock.mockResolvedValue([]);
  });

  it('returns no-store cache headers for course task lists', async () => {
    const { GET } = await import('@/app/api/tasks/route');

    const response = await GET(
      new Request('http://localhost/api/tasks?courseId=course-1') as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate, max-age=0',
    );
    await expect(response.json()).resolves.toEqual([]);
    expect(getUserCourseTasksMock).toHaveBeenCalledWith('course-1', 'user-1');
  });
});
