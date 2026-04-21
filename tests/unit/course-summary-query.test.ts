import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUserCourseMetadataMock = vi.fn();
const findUserCourseSummaryMetricsMock = vi.fn();
const findUserCourseSummaryCandidateTasksMock = vi.fn();

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message = 'Access denied') {
      super(message);
      this.name = 'AuthorizationError';
    }
  },
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));
vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/db/schema', () => ({
  courses: {},
  customLinks: {},
  subtasks: {},
  tasks: {},
}));
vi.mock('@/lib/utils/course/queries', () => ({
  findCourseByIdAndUser: vi.fn(),
  findCourseOwnershipByIdAndUser: vi.fn(),
  findTasksWithSubtasks: vi.fn(),
  findUserCourseMetadata: (...args: unknown[]) => findUserCourseMetadataMock(...args),
  findUserCourseSummaryCandidateTasks: (...args: unknown[]) => findUserCourseSummaryCandidateTasksMock(...args),
  findUserCourseSummaryMetrics: (...args: unknown[]) => findUserCourseSummaryMetricsMock(...args),
  findUserCoursesWithTasks: vi.fn(),
}));

describe('getUserCourseSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty list when the user has no courses', async () => {
    findUserCourseMetadataMock.mockResolvedValueOnce([]);
    findUserCourseSummaryMetricsMock.mockResolvedValueOnce([]);
    findUserCourseSummaryCandidateTasksMock.mockResolvedValueOnce([]);

    const { getUserCourseSummaries } = await import('@/lib/auth/db');

    await expect(getUserCourseSummaries('user-1')).resolves.toEqual([]);
  });

  it('merges metrics and selects next/upcoming previews per course', async () => {
    findUserCourseMetadataMock.mockResolvedValueOnce([
      { id: 'course-1', code: 'LOG210', name: 'Software Construction', color: 'blue', daypart: 'AM' },
      { id: 'course-2', code: 'MAT145', name: 'Linear Algebra', color: 'green', daypart: 'PM' },
    ]);
    findUserCourseSummaryMetricsMock.mockResolvedValueOnce([
      {
        courseId: 'course-1',
        totalTasks: 5,
        completedTasks: 2,
        inProgressTasks: 1,
        todoTasks: 2,
        overdueCount: 1,
        dueSoonCount: 2,
      },
      {
        courseId: 'course-2',
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        overdueCount: 0,
        dueSoonCount: 0,
      },
    ]);
    findUserCourseSummaryCandidateTasksMock.mockResolvedValueOnce([
      {
        courseId: 'course-1',
        id: 'task-1',
        title: 'Weekly reading',
        dueDate: new Date('2026-04-21T12:00:00.000Z'),
        type: 'theorie',
      },
      {
        courseId: 'course-1',
        id: 'task-2',
        title: 'Midterm',
        dueDate: new Date('2026-04-24T12:00:00.000Z'),
        type: 'exam',
      },
      {
        courseId: 'course-1',
        id: 'task-3',
        title: 'Homework 3',
        dueDate: new Date('2026-04-26T12:00:00.000Z'),
        type: 'homework',
      },
    ]);

    const { getUserCourseSummaries } = await import('@/lib/auth/db');
    const summaries = await getUserCourseSummaries('user-1');

    expect(summaries).toEqual([
      {
        id: 'course-1',
        code: 'LOG210',
        name: 'Software Construction',
        color: 'blue',
        daypart: 'AM',
        totalTasks: 5,
        completedTasks: 2,
        inProgressTasks: 1,
        todoTasks: 2,
        overdueCount: 1,
        dueSoonCount: 2,
        nextTask: {
          id: 'task-1',
          title: 'Weekly reading',
          dueDate: new Date('2026-04-21T12:00:00.000Z'),
        },
        upcomingTask: {
          id: 'task-2',
          title: 'Midterm',
          dueDate: new Date('2026-04-24T12:00:00.000Z'),
        },
      },
      {
        id: 'course-2',
        code: 'MAT145',
        name: 'Linear Algebra',
        color: 'green',
        daypart: 'PM',
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        nextTask: null,
        upcomingTask: null,
      },
    ]);
  });
});
