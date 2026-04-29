import { describe, expect, it } from 'vitest';
import { buildPomodoroHistoryCalendar } from '@/lib/pomodoro/history';

describe('buildPomodoroHistoryCalendar', () => {
  it('builds a weekly grid with range filtering and intensity levels', () => {
    const calendar = buildPomodoroHistoryCalendar([
      { day: new Date('2026-04-28T12:00:00.000Z'), totalMinutes: 25 },
      { day: new Date('2026-04-27T12:00:00.000Z'), totalMinutes: 75 },
      { day: new Date('2026-04-20T12:00:00.000Z'), totalMinutes: 100 },
    ], new Date('2026-04-28T16:00:00.000Z'));

    expect(calendar.weeks.length).toBeGreaterThanOrEqual(53);
    expect(calendar.totalMinutes).toBe(200);
    expect(calendar.activeDays).toBe(3);
    expect(calendar.monthLabels[0]?.label).toBe('May');
    expect(calendar.monthLabels.at(-1)?.label).toBe('Apr');

    const todayCell = calendar.weeks.flat().find(cell => cell.dateKey === '2026-04-28');
    const previousDayCell = calendar.weeks.flat().find(cell => cell.dateKey === '2026-04-27');
    const maxDayCell = calendar.weeks.flat().find(cell => cell.dateKey === '2026-04-20');

    expect(todayCell?.level).toBe(2);
    expect(previousDayCell?.level).toBe(4);
    expect(maxDayCell?.level).toBe(4);
  });

  it('only labels months whose first day is inside the visible range', () => {
    const calendar = buildPomodoroHistoryCalendar([], new Date('2026-04-29T16:00:00.000Z'));

    expect(calendar.monthLabels.map(label => label.label)).toEqual([
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
    ]);
  });
});
