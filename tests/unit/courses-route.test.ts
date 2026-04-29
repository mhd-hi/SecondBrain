import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));
vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/db/schema', () => ({
  users: {},
  accounts: {},
  sessions: {},
  terms: {},
  courses: {},
  tasks: {},
  subtasks: {},
  pomodoroDaily: {},
  customLinks: {},
  usersRelations: {},
  accountsRelations: {},
  sessionsRelations: {},
  coursesRelations: {},
  customLinksRelations: {},
  tasksRelations: {},
  subtasksRelations: {},
  deleteOldCourses: {},
}));

const getUserCourseSummariesMock = vi.fn();

vi.mock('@/lib/auth/db', () => ({
  assertUserOwnsCourse: vi.fn(),
  createUserCourse: vi.fn(),
  createUserTask: vi.fn(),
  deleteUserCourse: vi.fn(),
  deleteUserTask: vi.fn(),
  getUserCourse: vi.fn(),
  getUserCourseTasks: vi.fn(),
  getUserCourses: vi.fn(),
  getUserTask: vi.fn(),
  updateUserTask: vi.fn(),
}));
vi.mock('@/lib/auth/course-summaries', () => ({
  getUserCourseSummaries: (...args: unknown[]) => getUserCourseSummariesMock(...args),
}));

describe('courses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no-store cache headers for course summaries', async () => {
    getUserCourseSummariesMock.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/courses/route');
    const response = await GET(new Request('http://localhost/api/courses') as never, { id: 'user-1' } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate, max-age=0',
    );
    await expect(response.json()).resolves.toEqual([]);
    expect(getUserCourseSummariesMock).toHaveBeenCalledWith('user-1');
  });

  it('returns the lightweight dashboard summary shape', async () => {
    getUserCourseSummariesMock.mockResolvedValueOnce([
      {
        id: 'course-1',
        code: 'LOG210',
        name: 'Software Construction',
        color: 'blue',
        daypart: 'AM',
        totalTasks: 4,
        completedTasks: 1,
        inProgressTasks: 1,
        todoTasks: 2,
        overdueCount: 1,
        dueSoonCount: 2,
        nextTask: { id: 'task-1', title: 'Quiz 1', dueDate: new Date('2026-04-22T12:00:00.000Z') },
        upcomingTask: { id: 'task-2', title: 'Midterm', dueDate: new Date('2026-04-24T12:00:00.000Z') },
      },
    ]);

    const { GET } = await import('@/app/api/courses/route');
    const response = await GET(new Request('http://localhost/api/courses') as never, { id: 'user-1' } as never);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 'course-1',
      code: 'LOG210',
      totalTasks: 4,
      overdueCount: 1,
      dueSoonCount: 2,
      nextTask: {
        id: 'task-1',
        title: 'Quiz 1',
      },
      upcomingTask: {
        id: 'task-2',
        title: 'Midterm',
      },
    });
  });
});
