export type PomodoroDayLike = {
  day: Date;
};

export function startOfPomodoroDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toPomodoroDayKey(date: Date) {
  const normalized = startOfPomodoroDay(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculatePomodoroStreak(rows: PomodoroDayLike[], now = new Date()) {
  if (!rows.length) {
    return {
      streakDays: 0,
      lastCompletedPomodoroDate: null as Date | null,
    };
  }

  const normalizedDays = rows
    .map(row => startOfPomodoroDay(row.day))
    .sort((a, b) => b.getTime() - a.getTime());
  const dayKeys = new Set(normalizedDays.map(toPomodoroDayKey));
  const today = startOfPomodoroDay(now);
  const yesterday = addDays(today, -1);
  const lastCompletedPomodoroDate = normalizedDays[0] ?? null;

  let cursor: Date | null = null;
  if (dayKeys.has(toPomodoroDayKey(today))) {
    cursor = today;
  } else if (dayKeys.has(toPomodoroDayKey(yesterday))) {
    cursor = yesterday;
  } else {
    return {
      streakDays: 0,
      lastCompletedPomodoroDate,
    };
  }

  let streakDays = 0;
  while (cursor && dayKeys.has(toPomodoroDayKey(cursor))) {
    streakDays += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    streakDays,
    lastCompletedPomodoroDate,
  };
}
