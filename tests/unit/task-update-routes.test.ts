import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSubtaskUpdatePost } from '@/app/api/subtasks/update/route';
import { handleTaskUpdatePost } from '@/app/api/tasks/update/route';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';

function getApiErrorHandlerMock() {
  const testGlobal = globalThis as typeof globalThis & {
    __taskUpdateApiErrorHandlerMock?: ReturnType<typeof vi.fn>;
  };

  if (!testGlobal.__taskUpdateApiErrorHandlerMock) {
    testGlobal.__taskUpdateApiErrorHandlerMock = vi.fn();
  }

  return testGlobal.__taskUpdateApiErrorHandlerMock;
}

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

vi.mock('@/lib/utils/errors/error', () => ({
  ErrorHandlers: {
    api: (...args: unknown[]) =>
      (getApiErrorHandlerMock() as unknown as (...args: unknown[]) => unknown)(...args),
    silent: vi.fn(),
  },
}));

type DbState = {
  taskUpdateSetArg: Record<string, unknown> | null;
  subtaskUpdateSetArg: Record<string, unknown> | null;
  taskReturning: Array<{ id: string }>;
  subtaskReturning: Array<{ id: string }>;
  subtaskRows: Array<{ id: string; taskId: string }>;
  parentTaskRows: Array<{ id: string; userId: string }>;
};

type SchemaState = {
  tasks: {
    __table: 'tasks';
    id: symbol;
    userId: symbol;
    $inferSelect: Record<string, never>;
    $inferInsert: Record<string, never>;
  };
  subtasks: {
    __table: 'subtasks';
    id: symbol;
    taskId: symbol;
    $inferInsert: Record<string, never>;
  };
};

function createDbState(): DbState {
  return {
    taskUpdateSetArg: null,
    subtaskUpdateSetArg: null,
    taskReturning: [{ id: 'task-1' }],
    subtaskReturning: [{ id: 'subtask-1' }],
    subtaskRows: [{ id: 'subtask-1', taskId: 'task-1' }],
    parentTaskRows: [{ id: 'task-1', userId: 'user-1' }],
  };
}

function getDbState(): DbState {
  const testGlobal = globalThis as typeof globalThis & { __taskUpdateRouteDbState?: DbState };

  if (!testGlobal.__taskUpdateRouteDbState) {
    testGlobal.__taskUpdateRouteDbState = createDbState();
  }

  return testGlobal.__taskUpdateRouteDbState;
}

function resetDbState() {
  Object.assign(getDbState(), createDbState());
}

function getSchemaState(): SchemaState {
  const testGlobal = globalThis as typeof globalThis & { __taskUpdateRouteSchema?: SchemaState };

  if (!testGlobal.__taskUpdateRouteSchema) {
    testGlobal.__taskUpdateRouteSchema = {
      tasks: {
        __table: 'tasks',
        id: Symbol('tasks.id'),
        userId: Symbol('tasks.userId'),
        $inferSelect: {},
        $inferInsert: {},
      },
      subtasks: {
        __table: 'subtasks',
        id: Symbol('subtasks.id'),
        taskId: Symbol('subtasks.taskId'),
        $inferInsert: {},
      },
    };
  }

  return testGlobal.__taskUpdateRouteSchema;
}

const dbState = getDbState();
const originalFetch = globalThis.fetch;

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (...args: unknown[]) => args,
}));

vi.mock('@/server/db/schema', () => getSchemaState());

vi.mock('@/server/db', () => ({
  db: {
    update: (table: unknown) => ({
      set: (value: Record<string, unknown>) => {
        const state = getDbState();
        const tableName = (table as { __table?: string }).__table;

        if (tableName === 'tasks') {
          state.taskUpdateSetArg = value;
        } else {
          state.subtaskUpdateSetArg = value;
        }

        return {
          where: () => ({
            returning: async () => (tableName === 'tasks' ? state.taskReturning : state.subtaskReturning),
          }),
        };
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            const state = getDbState();
            return (table as { __table?: string }).__table === 'subtasks'
              ? state.subtaskRows
              : state.parentTaskRows;
          },
        }),
      }),
    }),
  },
}));

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

function installRouteFetchMock(userId = 'user-1') {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request
      ? input
      : new Request(typeof input === 'string' ? input : input.toString(), init);
    const pathname = new URL(request.url).pathname;

    if (pathname === API_ENDPOINTS.TASKS.UPDATE) {
      return handleTaskUpdatePost(request as never, { id: userId });
    }

    if (pathname === API_ENDPOINTS.TASKS.SUBTASK_UPDATE) {
      return handleSubtaskUpdatePost(request as never, { id: userId });
    }

    throw new Error(`Unhandled route for test fetch mock: ${pathname}`);
  });

  setFetchMock(fetchMock as unknown as typeof fetch);
  return fetchMock;
}

beforeEach(() => {
  resetDbState();
  getApiErrorHandlerMock().mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => { });
});

describe('legacy task update route', () => {
  it('updates supported task fields successfully through api.post', async () => {
    const fetchMock = installRouteFetchMock();

    const response = await api.post<{
      success: boolean;
      taskId: string;
      input: string;
    }>(
      `http://localhost${API_ENDPOINTS.TASKS.UPDATE}`,
      {
        taskId: 'task-1',
        input: 'estimatedEffort',
        value: '2.5',
      },
      'Failed to update task',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost${API_ENDPOINTS.TASKS.UPDATE}`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: 'task-1',
          input: 'estimatedEffort',
          value: '2.5',
        }),
      }),
    );
    expect(dbState.taskUpdateSetArg).toMatchObject({
      estimatedEffort: 2.5,
    });
    expect(dbState.taskUpdateSetArg?.updatedAt).toBeInstanceOf(Date);
    expect(response).toMatchObject({
      success: true,
      taskId: 'task-1',
      input: 'estimatedEffort',
    });
  });

  it('surfaces invalid field failures through api.post', async () => {
    installRouteFetchMock();

    await expect(
      api.post(
        `http://localhost${API_ENDPOINTS.TASKS.UPDATE}`,
        {
          taskId: 'task-1',
          input: 'week',
          value: 4,
        },
        'Failed to update task',
      ),
    ).rejects.toThrow(/Invalid field/);

    expect(dbState.taskUpdateSetArg).toBeNull();
    expect(getApiErrorHandlerMock()).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to update task',
    );
  });
});

describe('subtask update route', () => {
  it('updates supported subtask fields successfully through api.post', async () => {
    const fetchMock = installRouteFetchMock();

    const response = await api.post<{ success: boolean }>(
      `http://localhost${API_ENDPOINTS.TASKS.SUBTASK_UPDATE}`,
      {
        id: 'subtask-1',
        input: 'notes',
        value: 'Updated subtask description',
      },
      'Failed to update subtask',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost${API_ENDPOINTS.TASKS.SUBTASK_UPDATE}`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'subtask-1',
          input: 'notes',
          value: 'Updated subtask description',
        }),
      }),
    );
    expect(dbState.subtaskUpdateSetArg).toMatchObject({
      notes: 'Updated subtask description',
    });
    expect(dbState.subtaskUpdateSetArg?.updatedAt).toBeInstanceOf(Date);
    expect(response).toMatchObject({
      success: true,
    });
  });

  it('surfaces invalid subtask fields through api.post', async () => {
    installRouteFetchMock();

    await expect(
      api.post(
        `http://localhost${API_ENDPOINTS.TASKS.SUBTASK_UPDATE}`,
        {
          id: 'subtask-1',
          input: 'dueDate',
          value: '1.5',
        },
        'Failed to update subtask',
      ),
    ).rejects.toThrow(/Invalid field/);

    expect(dbState.subtaskUpdateSetArg).toBeNull();
    expect(getApiErrorHandlerMock()).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to update subtask',
    );
  });
});

afterEach(() => {
  setFetchMock(originalFetch);
  vi.restoreAllMocks();
});
