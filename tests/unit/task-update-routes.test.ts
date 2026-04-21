import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSubtaskUpdatePost } from '@/app/api/subtasks/update/route';
import { handleTaskUpdatePost } from '@/app/api/tasks/update/route';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
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
            return (table as { __table?: string }).__table === 'subtasks' ? state.subtaskRows : state.parentTaskRows;
          },
        }),
      }),
    }),
  },
}));

function createJsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetDbState();
});

describe('legacy task update route', () => {
  it('updates supported task fields successfully', async () => {
    const response = await handleTaskUpdatePost(
      createJsonRequest('http://localhost/api/tasks/update', {
        taskId: 'task-1',
        input: 'estimatedEffort',
        value: '2.5',
      }) as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(200);
    expect(dbState.taskUpdateSetArg).toMatchObject({
      estimatedEffort: 2.5,
    });
    expect(dbState.taskUpdateSetArg?.updatedAt).toBeInstanceOf(Date);

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      taskId: 'task-1',
      input: 'estimatedEffort',
    });
  });

  it('rejects the removed week field', async () => {
    const response = await handleTaskUpdatePost(
      createJsonRequest('http://localhost/api/tasks/update', {
        taskId: 'task-1',
        input: 'week',
        value: 4,
      }) as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(400);
    expect(dbState.taskUpdateSetArg).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Invalid field',
    });
  });
});

describe('subtask update route', () => {
  it('updates supported subtask fields successfully', async () => {
    const response = await handleSubtaskUpdatePost(
      createJsonRequest('http://localhost/api/subtasks/update', {
        id: 'subtask-1',
        input: 'notes',
        value: 'Updated subtask description',
      }) as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(200);
    expect(dbState.subtaskUpdateSetArg).toMatchObject({
      notes: 'Updated subtask description',
    });
    expect(dbState.subtaskUpdateSetArg?.updatedAt).toBeInstanceOf(Date);

    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
  });

  it('rejects the removed subtask due date field', async () => {
    const response = await handleSubtaskUpdatePost(
      createJsonRequest('http://localhost/api/subtasks/update', {
        id: 'subtask-1',
        input: 'dueDate',
        value: '1.5',
      }) as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(400);
    expect(dbState.subtaskUpdateSetArg).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Invalid field',
    });
  });
});
