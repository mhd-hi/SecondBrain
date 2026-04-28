import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusTask } from '@/types/status-task';

type QueryDbState = {
  taskRows: Array<Record<string, unknown>>;
  calendarRows: Array<Record<string, unknown>>;
  updatedRows: Array<Record<string, unknown>>;
};

function createQueryDbState(): QueryDbState {
  return {
    taskRows: [],
    calendarRows: [],
    updatedRows: [],
  };
}

function getQueryDbState() {
  const testGlobal = globalThis as typeof globalThis & { __taskQueriesDbState?: QueryDbState };

  if (!testGlobal.__taskQueriesDbState) {
    testGlobal.__taskQueriesDbState = createQueryDbState();
  }

  return testGlobal.__taskQueriesDbState;
}

async function importRealTaskQueries() {
  return import('@/lib/utils/task/queries');
}

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (...args: unknown[]) => args,
  gte: (...args: unknown[]) => args,
  inArray: (...args: unknown[]) => args,
  lt: (...args: unknown[]) => args,
  ne: (...args: unknown[]) => args,
  or: (...conditions: unknown[]) => conditions,
  sql: vi.fn(),
}));

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

vi.mock('@/server/db/schema', () => ({
  users: {},
  accounts: {},
  sessions: {},
  terms: {},
  tasks: {
    __table: 'tasks',
    id: Symbol('tasks.id'),
    courseId: Symbol('tasks.courseId'),
    title: Symbol('tasks.title'),
    notes: Symbol('tasks.notes'),
    type: Symbol('tasks.type'),
    status: Symbol('tasks.status'),
    estimatedEffort: Symbol('tasks.estimatedEffort'),
    actualEffort: Symbol('tasks.actualEffort'),
    createdAt: Symbol('tasks.createdAt'),
    updatedAt: Symbol('tasks.updatedAt'),
    dueDate: Symbol('tasks.dueDate'),
    userId: Symbol('tasks.userId'),
  },
  courses: {
    __table: 'courses',
    id: Symbol('courses.id'),
    userId: Symbol('courses.userId'),
    color: Symbol('courses.color'),
    daypart: Symbol('courses.daypart'),
    code: Symbol('courses.code'),
    name: Symbol('courses.name'),
    createdAt: Symbol('courses.createdAt'),
    updatedAt: Symbol('courses.updatedAt'),
  },
  subtasks: {
    __table: 'subtasks',
    id: Symbol('subtasks.id'),
    taskId: Symbol('subtasks.taskId'),
    title: Symbol('subtasks.title'),
    notes: Symbol('subtasks.notes'),
  },
  pomodoroDaily: {},
  customLinks: { __table: 'customLinks' },
  usersRelations: {},
  accountsRelations: {},
  sessionsRelations: {},
  coursesRelations: {},
  customLinksRelations: {},
  tasksRelations: {},
  subtasksRelations: {},
  deleteOldCourses: {},
}));

vi.mock('@/server/db', () => ({
  db: {
    select: (shape?: Record<string, unknown>) => ({
      from: (table: { __table?: string }) => {
        if (shape) {
          return {
            innerJoin: () => ({
              where: async () => getQueryDbState().calendarRows,
            }),
          };
        }

        return {
          where: () => ({
            leftJoin: async () => getQueryDbState().taskRows,
          }),
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => getQueryDbState().updatedRows,
        }),
      }),
    }),
  },
}));

describe('task queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(getQueryDbState(), createQueryDbState());
  });

  it('throws when getTasksForWeek is called without a user id', async () => {
    const { getTasksForWeek } = await importRealTaskQueries();

    await expect(
      getTasksForWeek(new Date('2026-05-01T00:00:00.000Z'), new Date('2026-05-08T00:00:00.000Z'), ''),
    ).rejects.toThrow(/User authentication required/);
  });

  it('maps joined task rows to tasks in getTasksForWeek', async () => {
    Object.assign(getQueryDbState(), {
      taskRows: [
        {
          tasks: {
            id: 'task-1',
            courseId: 'course-1',
            title: 'Week task',
            notes: null,
            type: 'homework',
            status: StatusTask.TODO,
            estimatedEffort: 2,
            actualEffort: 0,
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
            updatedAt: new Date('2026-05-01T01:00:00.000Z'),
            dueDate: new Date('2026-05-02T00:00:00.000Z'),
          },
          courses: {
            id: 'course-1',
            userId: 'user-1',
            name: 'Testing',
            code: 'LOG430',
            term: '20261',
            color: 'blue',
            daypart: 'PM',
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
            updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        },
      ],
    });

    const { getTasksForWeek } = await importRealTaskQueries();
    const tasks = await getTasksForWeek(
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-08T00:00:00.000Z'),
      'user-1',
    );

    expect(tasks).toEqual([
      expect.objectContaining({
        id: 'task-1',
        title: 'Week task',
        notes: undefined,
        course: expect.objectContaining({
          id: 'course-1',
          code: 'LOG430',
        }),
      }),
    ]);
  });

  it('throws when batchUpdateStatusTask is called without a user id', async () => {
    const { batchUpdateStatusTask } = await importRealTaskQueries();

    await expect(
      batchUpdateStatusTask(['task-1'], StatusTask.COMPLETED, ''),
    ).rejects.toThrow(/User authentication required/);
  });

  it('returns an empty array when batchUpdateStatusTask receives no task ids', async () => {
    const { batchUpdateStatusTask } = await importRealTaskQueries();

    await expect(
      batchUpdateStatusTask([], StatusTask.COMPLETED, 'user-1'),
    ).resolves.toEqual([]);
  });

  it('maps calendar query rows to events with taskToEvent', async () => {
    const eventUtils = await import('@/calendar/event-utils');
    const taskToEventSpy = vi.spyOn(eventUtils, 'taskToEvent').mockImplementation((task) => ({
      id: `event-${task.id}`,
      title: task.title,
      startDate: '2026-05-02T08:00:00.000Z',
      endDate: '2026-05-02T09:00:00.000Z',
      type: 'task',
      color: 'blue',
    }));

    Object.assign(getQueryDbState(), {
      calendarRows: [
        {
          id: 'task-1',
          courseId: 'course-1',
          title: 'Calendar task',
          notes: null,
          type: 'homework',
          status: StatusTask.TODO,
          estimatedEffort: 2,
          actualEffort: 0,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          dueDate: new Date('2026-05-02T00:00:00.000Z'),
          course: {
            id: 'course-1',
            color: 'blue',
            daypart: 'PM',
            code: 'LOG430',
            name: 'Testing',
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
            updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        },
      ],
    });

    const { getCalendarEvents } = await importRealTaskQueries();
    const events = await getCalendarEvents(
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-08T00:00:00.000Z'),
      'user-1',
    );

    expect(taskToEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        title: 'Calendar task',
        course: expect.objectContaining({
          id: 'course-1',
          code: 'LOG430',
        }),
      }),
    );
    expect(events).toEqual([{
      id: 'event-task-1',
      title: 'Calendar task',
      startDate: '2026-05-02T08:00:00.000Z',
      endDate: '2026-05-02T09:00:00.000Z',
      type: 'task',
      color: 'blue',
    }]);
    taskToEventSpy.mockRestore();
  });

  it('wraps calendar query failures with a stable error message', async () => {
    const dbModule = await import('@/server/db');
    const selectSpy = vi.spyOn(dbModule.db, 'select').mockImplementation(() => {
      throw new Error('db exploded');
    });

    const { getCalendarEvents } = await importRealTaskQueries();

    await expect(
      getCalendarEvents(
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-05-08T00:00:00.000Z'),
        'user-1',
      ),
    ).rejects.toThrow('Failed to fetch calendar events');

    selectSpy.mockRestore();
  });
});
