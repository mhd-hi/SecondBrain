import { beforeEach, describe, expect, it, vi } from 'vitest';

type PomodoroDailyRow = {
  day: Date;
};

function getPomodoroRows() {
  const testGlobal = globalThis as typeof globalThis & { __pomodoroStreakRows?: PomodoroDailyRow[] };
  return testGlobal.__pomodoroStreakRows ?? [];
}

function setPomodoroRows(rows: PomodoroDailyRow[]) {
  const testGlobal = globalThis as typeof globalThis & { __pomodoroStreakRows?: PomodoroDailyRow[] };
  testGlobal.__pomodoroStreakRows = rows;
}

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => args,
}));

vi.mock('@/server/db/schema', () => ({
  pomodoroDaily: {
    __table: 'pomodoro_daily',
    userId: Symbol('pomodoroDaily.userId'),
    day: Symbol('pomodoroDaily.day'),
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => getPomodoroRows(),
      }),
    }),
  },
}));

const { GET } = await import('@/app/api/pomodoro/streak/route');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-28T16:00:00.000Z'));
  setPomodoroRows([]);
  vi.clearAllMocks();
});

describe('pomodoro streak route', () => {
  it('returns zero when there is no pomodoro history', async () => {
    const response = await GET(
      new Request('http://localhost/api/pomodoro/streak') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      streakDays: 0,
      lastCompletedPomodoroDate: null,
    });
  });

  it('returns the full consecutive streak when the latest completion was yesterday', async () => {
    setPomodoroRows([
      { day: new Date('2026-04-27T12:00:00.000Z') },
      { day: new Date('2026-04-26T12:00:00.000Z') },
      { day: new Date('2026-04-25T12:00:00.000Z') },
    ]);

    const response = await GET(
      new Request('http://localhost/api/pomodoro/streak') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      streakDays: 3,
    });
  });

  it('returns zero when the latest completion is older than yesterday', async () => {
    setPomodoroRows([
      { day: new Date('2026-04-25T12:00:00.000Z') },
      { day: new Date('2026-04-24T12:00:00.000Z') },
    ]);

    const response = await GET(
      new Request('http://localhost/api/pomodoro/streak') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      streakDays: 0,
    });
  });
});
