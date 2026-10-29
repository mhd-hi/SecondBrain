import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/lib/auth/api';
import { updateUserTask, updateUserTaskWithExecutor } from '@/lib/auth/db';

type Row = Record<string, unknown>;

const captured = {
  taskSet: null as Row | null,
  taskWhere: null as unknown,
  taskReturning: [] as Row[],
  subtaskSet: null as Row | null,
  subtaskWhere: null as unknown,
  subtaskReturning: [] as Row[],
  existingSubtaskRows: [] as Array<{ id: string }>,
};

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message = 'Access denied') {
      super(message);
      this.name = 'AuthorizationError';
    }
  },
}));

vi.mock('@/lib/utils/course/queries', () => ({
  findCourseByIdAndUser: vi.fn(),
  findCourseOwnershipByIdAndUser: vi.fn(),
  findTasksWithSubtasks: vi.fn(),
  findUserCoursesWithTasks: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (...args: unknown[]) => ({ eq: args }),
}));

vi.mock('@/server/db/schema', () => ({
  tasks: { __table: 'tasks', id: Symbol('tasks.id'), userId: Symbol('tasks.userId') },
  subtasks: { __table: 'subtasks', id: Symbol('subtasks.id'), taskId: Symbol('subtasks.taskId') },
  courses: { __table: 'courses' },
}));

vi.mock('@/server/db', () => ({
  db: {
    update: (table: { __table?: string }) => ({
      set: (value: Row) => ({
        where: (pred: unknown) => ({
          returning: async () => {
            if (table.__table === 'tasks') {
              captured.taskSet = value;
              captured.taskWhere = pred;
              return captured.taskReturning;
            }
            captured.subtaskSet = value;
            captured.subtaskWhere = pred;
            return captured.subtaskReturning;
          },
        }),
      }),
    }),
    select: () => ({
      from: (_table: { __table?: string }) => ({
        where: async () => captured.existingSubtaskRows,
      }),
    }),
    insert: () => ({
      values: async () => ({ returning: async () => [{ id: 'new-subtask' }] }),
    }),
    delete: () => ({
      where: async () => ({ returning: async () => [] }),
    }),
  },
}));

beforeEach(() => {
  captured.taskSet = null;
  captured.taskWhere = null;
  captured.taskReturning = [{ id: 'task-1', userId: 'user-1' }];
  captured.subtaskSet = null;
  captured.subtaskWhere = null;
  captured.subtaskReturning = [];
  captured.existingSubtaskRows = [];
  vi.clearAllMocks();
});

describe('updateUserTaskWithExecutor mass-assignment guard', () => {
  it('strips id, userId, and createdAt from the update set', async () => {
    await updateUserTaskWithExecutor(
      (vi.mocked(await import('@/server/db')).db) as never,
      'task-1',
      'user-1',
      {
        title: 'new title',
        userId: 'attacker',
        id: 'row-2',
        createdAt: new Date(0),
      },
    );

    expect(captured.taskSet).not.toBeNull();
    expect(captured.taskSet).not.toHaveProperty('userId');
    expect(captured.taskSet).not.toHaveProperty('id');
    expect(captured.taskSet).not.toHaveProperty('createdAt');
    expect(captured.taskSet).toHaveProperty('title', 'new title');
    expect(captured.taskSet).toHaveProperty('updatedAt');
  });

  it('keeps the ownership predicate on id + userId', async () => {
    await updateUserTaskWithExecutor(
      (vi.mocked(await import('@/server/db')).db) as never,
      'task-1',
      'user-1',
      { title: 'x' },
    );

    expect(captured.taskWhere).toEqual({
      and: [
        { eq: [expect.any(Symbol), 'task-1'] },
        { eq: [expect.any(Symbol), 'user-1'] },
      ],
    });
  });
});

describe('updateUserTask subtask tenant scoping', () => {
  it('rejects a subtask id that does not belong to the task', async () => {
    captured.existingSubtaskRows = [{ id: 'own-subtask' }];
    captured.subtaskReturning = [];

    await expect(
      updateUserTask('task-1', 'user-1', {
        subtasks: [{ id: 'foreign-subtask', title: 'injected' }],
      } as never),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(captured.subtaskWhere).toEqual({
      and: [
        { eq: [expect.any(Symbol), 'foreign-subtask'] },
        { eq: [expect.any(Symbol), 'task-1'] },
      ],
    });
  });

  it('updates a subtask that belongs to the task', async () => {
    captured.existingSubtaskRows = [{ id: 'own-subtask' }];
    captured.subtaskReturning = [{ id: 'own-subtask' }];

    await expect(
      updateUserTask('task-1', 'user-1', {
        subtasks: [{ id: 'own-subtask', title: 'ok' }],
      } as never),
    ).resolves.toBeTruthy();

    expect(captured.subtaskSet).toHaveProperty('title', 'ok');
  });
});
