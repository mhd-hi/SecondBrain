import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserTaskMock = vi.fn();

type RouteDbState = {
  createdRows: Array<Record<string, unknown>>;
  parentTaskRows: Array<Record<string, unknown>>;
  deletedRows: Array<Record<string, unknown>>;
  insertedValues: Record<string, unknown> | null;
};

function createRouteDbState(): RouteDbState {
  return {
    createdRows: [{ id: 'subtask-1', taskId: 'task-1', title: 'Draft outline', notes: 'Initial notes' }],
    parentTaskRows: [{ id: 'task-1', userId: 'user-1' }],
    deletedRows: [{ id: 'subtask-1' }],
    insertedValues: null,
  };
}

function getRouteDbState() {
  const testGlobal = globalThis as typeof globalThis & { __taskSubtaskRouteDbState?: RouteDbState };

  if (!testGlobal.__taskSubtaskRouteDbState) {
    testGlobal.__taskSubtaskRouteDbState = createRouteDbState();
  }

  return testGlobal.__taskSubtaskRouteDbState;
}

function resetRouteDbState() {
  Object.assign(getRouteDbState(), createRouteDbState());
}

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

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

vi.mock('@/lib/auth/db', () => ({
  assertUserOwnsCourse: vi.fn(),
  createUserCourse: vi.fn(),
  createUserTask: vi.fn(),
  deleteUserCourse: vi.fn(),
  deleteUserTask: vi.fn(),
  getUserCourse: vi.fn(),
  getUserCourseSummaries: vi.fn(),
  getUserCourseTasks: vi.fn(),
  getUserCourses: vi.fn(),
  getUserTask: (...args: unknown[]) => getUserTaskMock(...args),
  updateUserTask: vi.fn(),
}));

vi.mock('@/server/db/schema', () => ({
  users: {},
  accounts: {},
  sessions: {},
  terms: {},
  subtasks: {
    __table: 'subtasks',
    id: Symbol('subtasks.id'),
    taskId: Symbol('subtasks.taskId'),
    $inferInsert: {},
  },
  tasks: {
    __table: 'tasks',
    id: Symbol('tasks.id'),
    userId: Symbol('tasks.userId'),
    $inferInsert: {},
  },
  courses: {
    __table: 'courses',
    id: Symbol('courses.id'),
    code: Symbol('courses.code'),
    name: Symbol('courses.name'),
    color: Symbol('courses.color'),
    daypart: Symbol('courses.daypart'),
    createdAt: Symbol('courses.createdAt'),
    updatedAt: Symbol('courses.updatedAt'),
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
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        getRouteDbState().insertedValues = value;
        return {
          returning: async () => getRouteDbState().createdRows,
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => getRouteDbState().parentTaskRows,
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: async () => getRouteDbState().deletedRows,
      }),
    }),
  },
}));

const { POST } = await import('@/app/api/tasks/[taskId]/subtasks/route');
const { DELETE } = await import('@/app/api/tasks/[taskId]/subtasks/[subtaskId]/route');

beforeEach(() => {
  resetRouteDbState();
  vi.resetAllMocks();
  getUserTaskMock.mockResolvedValue({ id: 'task-1', userId: 'user-1' });
});

describe('task subtask routes authorization', () => {
  it('returns 404 when creating a subtask for a parent task the user does not own', async () => {
    getUserTaskMock.mockRejectedValue(new Error('Task not found'));

    const response = await POST(
      new Request('http://localhost/api/tasks/task-1/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Draft outline', notes: 'Initial notes' }),
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Task not found or unauthorized' });
  });

  it('creates a subtask with default title and notes when omitted', async () => {
    const randomUuidSpy = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('generated-subtask-id');

    const response = await POST(
      new Request('http://localhost/api/tasks/task-1/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(200);
    expect(getRouteDbState().insertedValues).toEqual(
      expect.objectContaining({
        id: 'generated-subtask-id',
        taskId: 'task-1',
        title: '',
        notes: null,
      }),
    );
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      id: 'subtask-1',
      taskId: 'task-1',
      title: 'Draft outline',
      notes: 'Initial notes',
    }));

    randomUuidSpy.mockRestore();
  });

  it('returns 404 when deleting a subtask from a parent task the user does not own', async () => {
    getRouteDbState().parentTaskRows = [];

    const response = await DELETE(
      new Request('http://localhost/api/tasks/task-1/subtasks/subtask-1', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1', subtaskId: 'subtask-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Task not found or unauthorized' });
  });

  it('returns 404 when the subtask does not belong to the provided parent task', async () => {
    getRouteDbState().deletedRows = [];

    const response = await DELETE(
      new Request('http://localhost/api/tasks/task-1/subtasks/subtask-foreign', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1', subtaskId: 'subtask-foreign' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Subtask not found' });
  });
});
