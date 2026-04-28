import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserTaskMock = vi.fn();

type RouteDbState = {
  createdRows: Array<Record<string, unknown>>;
  parentTaskRows: Array<Record<string, unknown>>;
  deletedRows: Array<Record<string, unknown>>;
};

function createRouteDbState(): RouteDbState {
  return {
    createdRows: [{ id: 'subtask-1', taskId: 'task-1', title: 'Draft outline', notes: 'Initial notes' }],
    parentTaskRows: [{ id: 'task-1', userId: 'user-1' }],
    deletedRows: [{ id: 'subtask-1' }],
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
  withAuth: vi.fn((handler: unknown) => handler),
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (...args: unknown[]) => args,
}));

vi.mock('@/lib/auth/db', () => ({
  getUserTask: (...args: unknown[]) => getUserTaskMock(...args),
}));

vi.mock('@/server/db/schema', () => ({
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
}));

vi.mock('@/server/db', () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: async () => getRouteDbState().createdRows,
      }),
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
