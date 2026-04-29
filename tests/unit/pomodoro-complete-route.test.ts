import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PomodoroDbState = {
  dailyRows: Array<{
    id: string;
    userId: string;
    day: Date;
    totalMinutes: number;
  }>;
  insertValues: Record<string, unknown> | null;
  onConflictArgs: Record<string, unknown> | null;
  insertCalls: number;
};

function createPomodoroDbState(): PomodoroDbState {
  return {
    dailyRows: [
      { id: 'day-1', userId: 'user-1', day: new Date('2026-04-27T12:00:00.000Z'), totalMinutes: 25 },
      { id: 'day-2', userId: 'user-1', day: new Date('2026-04-26T12:00:00.000Z'), totalMinutes: 25 },
    ],
    insertValues: null,
    onConflictArgs: null,
    insertCalls: 0,
  };
}

function getPomodoroDbState() {
  const testGlobal = globalThis as typeof globalThis & { __pomodoroCompleteDbState?: PomodoroDbState };

  if (!testGlobal.__pomodoroCompleteDbState) {
    testGlobal.__pomodoroCompleteDbState = createPomodoroDbState();
  }

  return testGlobal.__pomodoroCompleteDbState;
}

function resetPomodoroDbState() {
  Object.assign(getPomodoroDbState(), createPomodoroDbState());
}

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error { },
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  }),
}));

vi.mock('@/server/db/schema', () => ({
  users: {},
  accounts: {},
  sessions: {},
  terms: {},
  courses: {},
  tasks: {},
  subtasks: {},
  pomodoroDaily: {
    __table: 'pomodoro_daily',
    id: Symbol('pomodoroDaily.id'),
    userId: Symbol('pomodoroDaily.userId'),
    day: Symbol('pomodoroDaily.day'),
    totalMinutes: Symbol('pomodoroDaily.totalMinutes'),
  },
  customLinks: {},
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
        const state = getPomodoroDbState();
        state.insertValues = value;
        state.insertCalls += 1;
        return {
          onConflictDoUpdate: async (args: Record<string, unknown>) => {
            state.onConflictArgs = args;
            const day = value.day as Date;
            const userId = value.userId as string;
            const totalMinutes = value.totalMinutes as number;
            const existingRow = state.dailyRows.find(row =>
              row.userId === userId
              && row.day.getFullYear() === day.getFullYear()
              && row.day.getMonth() === day.getMonth()
              && row.day.getDate() === day.getDate(),
            );

            if (existingRow) {
              existingRow.totalMinutes += totalMinutes;
            } else {
              state.dailyRows = [
                ...state.dailyRows,
                {
                  id: `day-${state.dailyRows.length + 1}`,
                  userId,
                  day,
                  totalMinutes,
                },
              ];
            }
            return [];
          },
        };
      },
    }),
  },
}));

const { POST } = await import('@/app/api/pomodoro/complete/route');

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-28T16:00:00.000Z').getTime());
  resetPomodoroDbState();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pomodoro complete route', () => {
  it('rejects non-positive durations', async () => {
    const response = await POST(
      new Request('http://localhost/api/pomodoro/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationHours: 0 }),
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Valid durationHours is required' });
    expect(getPomodoroDbState().insertCalls).toBe(0);
  });

  it('creates a row for today and returns success', async () => {
    const threeSecondsInHours = 3 / 3600;
    const threeSecondsInMinutes = 3 / 60;

    const response = await POST(
      new Request('http://localhost/api/pomodoro/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationHours: threeSecondsInHours }),
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    expect(getPomodoroDbState().insertCalls).toBe(1);
    expect(getPomodoroDbState().insertValues).toMatchObject({
      userId: 'user-1',
    });
    expect(getPomodoroDbState().insertValues?.totalMinutes).toBeCloseTo(threeSecondsInMinutes, 6);
    expect(getPomodoroDbState().onConflictArgs).toMatchObject({
      target: expect.any(Array),
      set: expect.objectContaining({
        totalMinutes: expect.any(Object),
      }),
    });
    expect(getPomodoroDbState().insertValues?.day).toBeInstanceOf(Date);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
  });

  it('adds hours to the current day when a pomodoro was already completed today', async () => {
    getPomodoroDbState().dailyRows = [
      { id: 'day-0', userId: 'user-1', day: new Date('2026-04-28T12:00:00.000Z'), totalMinutes: 25 },
      { id: 'day-1', userId: 'user-1', day: new Date('2026-04-27T12:00:00.000Z'), totalMinutes: 25 },
      { id: 'day-2', userId: 'user-1', day: new Date('2026-04-26T12:00:00.000Z'), totalMinutes: 25 },
      { id: 'day-3', userId: 'user-1', day: new Date('2026-04-25T12:00:00.000Z'), totalMinutes: 25 },
    ];

    const response = await POST(
      new Request('http://localhost/api/pomodoro/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationHours: 0.5 }),
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    expect(getPomodoroDbState().insertCalls).toBe(1);
    expect(getPomodoroDbState().onConflictArgs).toMatchObject({
      target: expect.any(Array),
      set: expect.objectContaining({
        totalMinutes: expect.any(Object),
      }),
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
  });
});
