/* eslint-disable ts/no-explicit-any */
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/lib/auth/api';

const authMock = vi.fn();
const assertUserOwnsCourseMock = vi.fn();

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
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
          return Response.json(
            { code: 'UNAUTHORIZED', error: error.message },
            { status: 403 },
          );
        }
        throw error;
      }
    }),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));
vi.mock('@/server/auth', () => ({ auth: (...args: unknown[]) => authMock(...args) }));
vi.mock('@/server/db', () => ({
  db: {
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));
vi.mock('@/server/db/schema', () => ({
  users: {},
  accounts: {},
  sessions: {},
  terms: {},
  courses: {},
  tasks: {},
  subtasks: {},
  pomodoroDaily: {},
  customLinks: {
    id: Symbol('customLinks.id'),
    courseId: Symbol('customLinks.courseId'),
    userId: Symbol('customLinks.userId'),
  },
  usersRelations: {},
  accountsRelations: {},
  sessionsRelations: {},
  coursesRelations: {},
  customLinksRelations: {},
  tasksRelations: {},
  subtasksRelations: {},
  deleteOldCourses: {},
}));
vi.mock('@/lib/auth/db', () => ({
  assertUserOwnsCourse: (...args: unknown[]) => assertUserOwnsCourseMock(...args),
  createUserCourse: vi.fn(),
  createUserTask: vi.fn(),
  deleteUserCourse: vi.fn(),
  deleteUserTask: vi.fn(),
  getUserCourse: vi.fn(),
  getUserCourseSummaries: vi.fn(),
  getUserCourseTasks: vi.fn(),
  getUserCourses: vi.fn(),
  getUserTask: vi.fn(),
  updateUserTask: vi.fn(),
}));

describe('custom links route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when creating a course-scoped link for a course the user does not own', async () => {
    (authMock as unknown as Mock).mockResolvedValue({ user: { id: 'user-1' } } as any);
    assertUserOwnsCourseMock.mockRejectedValue(new AuthorizationError('Course not found'));

    const { POST } = await import('@/app/api/custom-links/route');
    const response = await POST(
      new Request('http://localhost/api/custom-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Portal',
          url: 'example.com',
          courseId: 'foreign-course',
        }),
      }) as never,
      { user: { id: 'user-1' }, params: Promise.resolve({}) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: 'UNAUTHORIZED',
      error: 'Course not found',
    });
  });
});
