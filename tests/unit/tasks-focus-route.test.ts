import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api', () => ({
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
    status: string;
    notes: string | null;
    estimatedEffort: number;
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
}));

vi.mock('@/server/db/schema', () => ({
  courses: {
    __table: 'courses',
    id: Symbol('courses.id'),
    code: Symbol('courses.code'),
    name: Symbol('courses.name'),
    color: Symbol('courses.color'),
  },
  subtasks: {
    __table: 'subtasks',
    id: Symbol('subtasks.id'),
    taskId: Symbol('subtasks.taskId'),
    title: Symbol('subtasks.title'),
    status: Symbol('subtasks.status'),
    notes: Symbol('subtasks.notes'),
    estimatedEffort: Symbol('subtasks.estimatedEffort'),
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
    Object.assign(getDbState(), createDbState());
  });

  it('returns no-store cache headers for focus tasks', async () => {
    const { GET } = await import('@/app/api/tasks/focus/route');

    const response = await GET(
      new Request('http://localhost/api/tasks/focus?filter=week') as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate, max-age=0',
    );
    await expect(response.json()).resolves.toEqual([]);
  });
});
