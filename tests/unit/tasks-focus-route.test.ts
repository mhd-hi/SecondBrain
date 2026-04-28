import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusTask } from '@/types/status-task';
import { restoreSystemDate, setSystemDate } from '../helpers/runtime';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

type FocusDbState = {
  taskRows: Array<{
    id: string;
    courseId: string;
    title: string;
    notes: string | null;
    type: string;
    status: string;
    estimatedEffort: number;
    actualEffort: number;
    dueDate: Date;
    courseCode: string;
    courseName: string;
    courseColor: string;
  }>;
  subtaskRows: Array<{
    id: string;
    taskId: string;
    title: string;
    notes: string | null;
  }>;
};

function createDbState(): FocusDbState {
  return {
    taskRows: [],
    subtaskRows: [],
  };
}

function getDbState(): FocusDbState {
  const testGlobal = globalThis as typeof globalThis & { __tasksFocusRouteDbState?: FocusDbState };

  if (!testGlobal.__tasksFocusRouteDbState) {
    testGlobal.__tasksFocusRouteDbState = createDbState();
  }

  return testGlobal.__tasksFocusRouteDbState;
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

vi.mock('@/server/db/schema', () => ({
  users: {},
  accounts: {},
  sessions: {},
  terms: {},
  courses: {
    __table: 'courses',
    id: Symbol('courses.id'),
    code: Symbol('courses.code'),
    name: Symbol('courses.name'),
    color: Symbol('courses.color'),
  },
  tasks: {
    __table: 'tasks',
    id: Symbol('tasks.id'),
    courseId: Symbol('tasks.courseId'),
    userId: Symbol('tasks.userId'),
    title: Symbol('tasks.title'),
    notes: Symbol('tasks.notes'),
    type: Symbol('tasks.type'),
    status: Symbol('tasks.status'),
    estimatedEffort: Symbol('tasks.estimatedEffort'),
    actualEffort: Symbol('tasks.actualEffort'),
    dueDate: Symbol('tasks.dueDate'),
  },
  subtasks: {
    __table: 'subtasks',
    id: Symbol('subtasks.id'),
    taskId: Symbol('subtasks.taskId'),
    title: Symbol('subtasks.title'),
    notes: Symbol('subtasks.notes'),
  },
  pomodoroDaily: {},
  customLinks: {
    __table: 'customLinks',
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

vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const tableName = (table as { __table?: string } | undefined)?.__table;

        if (tableName === 'subtasks') {
          return {
            where: async () => getDbState().subtaskRows,
          };
        }

        return {
          innerJoin: () => ({
            where: async () => getDbState().taskRows,
          }),
        };
      },
    }),
  },
}));

describe('tasks focus route cache headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSystemDate(new Date('2026-04-27T12:00:00.000Z'));
    Object.assign(getDbState(), createDbState());
  });

  it('returns no-store cache headers for focus tasks', async () => {
    const { GET } = await import('@/app/api/tasks/focus/route');
    const getRoute = GET as unknown as (
      request: Request,
      user: { id: string },
    ) => Promise<Response>;

    const response = await getRoute(
      new Request('http://localhost/api/tasks/focus?filter=week') as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate, max-age=0',
    );
    await expect(response.json()).resolves.toEqual([]);
  });

  it('maps course metadata, normalizes statuses, and attaches subtasks to matching tasks', async () => {
    Object.assign(getDbState(), {
      taskRows: [
        {
          id: 'task-1',
          courseId: 'course-1',
          title: 'Overdue task',
          notes: null,
          type: 'homework',
          status: 'TODO',
          estimatedEffort: 2,
          actualEffort: 0,
          dueDate: new Date('2026-04-24T12:00:00.000Z'),
          courseCode: 'LOG430',
          courseName: 'Testing',
          courseColor: 'blue',
        },
        {
          id: 'task-2',
          courseId: 'course-2',
          title: 'Unknown status task',
          notes: 'Has notes',
          type: 'exam',
          status: 'BROKEN_STATUS',
          estimatedEffort: 3,
          actualEffort: 1,
          dueDate: new Date('2026-04-29T12:00:00.000Z'),
          courseCode: 'LOG530',
          courseName: 'Reengineering',
          courseColor: 'red',
        },
      ],
      subtaskRows: [
        {
          id: 'subtask-1',
          taskId: 'task-2',
          title: 'Draft outline',
          notes: null,
        },
      ],
    });

    const { GET } = await import('@/app/api/tasks/focus/route');
    const response = await GET(
      new Request('http://localhost/api/tasks/focus?filter=month') as never,
      { id: 'user-1' } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: 'task-1',
        userId: 'user-1',
        status: StatusTask.TODO,
        subtasks: [],
        course: expect.objectContaining({
          id: 'course-1',
          code: 'LOG430',
          name: 'Testing',
          color: 'blue',
          userId: 'user-1',
        }),
      }),
      expect.objectContaining({
        id: 'task-2',
        userId: 'user-1',
        status: StatusTask.TODO,
        notes: 'Has notes',
        subtasks: [
          {
            id: 'subtask-1',
            title: 'Draft outline',
          },
        ],
        course: expect.objectContaining({
          id: 'course-2',
          code: 'LOG530',
          name: 'Reengineering',
          color: 'red',
          userId: 'user-1',
        }),
      }),
    ]);
  });

  afterEach(() => {
    restoreSystemDate();
  });
});
