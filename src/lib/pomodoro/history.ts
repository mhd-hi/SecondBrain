import { startOfPomodoroDay, toPomodoroDayKey } from '@/lib/pomodoro/date';

export type PomodoroHistoryRow = {
  day: Date;
  totalMinutes: number;
};

export type PomodoroHistoryCell = {
  date: Date;
  dateKey: string;
  totalMinutes: number;
  level: 0 | 1 | 2 | 3 | 4;
  isInRange: boolean;
};

export type PomodoroHistoryMonthLabel = {
  weekIndex: number;
  label: string;
};

export type PomodoroHistoryCalendar = {
  weeks: PomodoroHistoryCell[][];
  monthLabels: PomodoroHistoryMonthLabel[];
  totalMinutes: number;
  activeDays: number;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isFirstDayOfMonth(date: Date) {
  return date.getDate() === 1;
}

function getLevel(totalMinutes: number, maxMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (totalMinutes <= 0 || maxMinutes <= 0) {
    return 0;
  }

  const ratio = totalMinutes / maxMinutes;
  if (ratio >= 0.75) {
    return 4;
  }
  if (ratio >= 0.5) {
    return 3;
  }
  if (ratio >= 0.25) {
    return 2;
  }
  return 1;
}

export function buildPomodoroHistoryCalendar(
  rows: PomodoroHistoryRow[],
  endDate = new Date(),
  days = 365,
): PomodoroHistoryCalendar {
  const normalizedEnd = startOfPomodoroDay(endDate);
  const normalizedStart = addDays(normalizedEnd, -(days - 1));
  const gridStart = addDays(normalizedStart, -normalizedStart.getDay());
  const gridEnd = addDays(normalizedEnd, 6 - normalizedEnd.getDay());

  const dayMap = new Map(
    rows.map(row => [
      toPomodoroDayKey(row.day),
      Math.max(0, row.totalMinutes),
    ]),
  );

  let totalMinutes = 0;
  let activeDays = 0;
  let maxMinutes = 0;

  for (const [dateKey, minutes] of dayMap.entries()) {
    const date = new Date(`${dateKey}T00:00:00`);
    if (date < normalizedStart || date > normalizedEnd) {
      continue;
    }

    totalMinutes += minutes;
    if (minutes > 0) {
      activeDays += 1;
      maxMinutes = Math.max(maxMinutes, minutes);
    }
  }

  const weeks: PomodoroHistoryCell[][] = [];
  const monthLabels: PomodoroHistoryMonthLabel[] = [];
  let cursor = new Date(gridStart);
  let weekIndex = 0;

  while (cursor <= gridEnd) {
    const week: PomodoroHistoryCell[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const cellDate = new Date(cursor);
      const dateKey = toPomodoroDayKey(cellDate);
      const isInRange = cellDate >= normalizedStart && cellDate <= normalizedEnd;
      const totalDayMinutes = isInRange ? (dayMap.get(dateKey) ?? 0) : 0;

      week.push({
        date: cellDate,
        dateKey,
        totalMinutes: totalDayMinutes,
        level: isInRange ? getLevel(totalDayMinutes, maxMinutes) : 0,
        isInRange,
      });

      cursor = addDays(cursor, 1);
    }

    const labelAnchor = week.find(cell => cell.isInRange && isFirstDayOfMonth(cell.date));

    if (labelAnchor) {
      monthLabels.push({
        weekIndex,
        label: labelAnchor.date.toLocaleString('en-US', { month: 'short' }),
      });
    }

    weeks.push(week);
    weekIndex += 1;
  }

  return {
    weeks,
    monthLabels,
    totalMinutes,
    activeDays,
  };
}
