import { describe, expect, it } from 'vitest';
import {
  addDateOnlyDays,
  formatTorontoDate,
  parseTorontoDueDate,
  resolveTermWeekDates,
} from '@/lib/ai/chat/date';

describe('AI chat Toronto dates', () => {
  it.each(['2026-01-15', '2026-07-15'])(
    'stores %s at noon in Toronto',
    (dateOnly) => {
      const date = parseTorontoDueDate(dateOnly);

      expect(formatTorontoDate(date)).toBe(dateOnly);
      expect(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Toronto',
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(date),
      ).toBe('12');
    },
  );

  it('advances calendar dates across daylight-saving boundaries', () => {
    expect(addDateOnlyDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('rejects impossible dates', () => {
    expect(() => parseTorontoDueDate('2026-02-31')).toThrow();
  });

  it('resolves semester weeks from the app term calendar', () => {
    expect(resolveTermWeekDates('20262', 3)).toEqual([
      { date: '2026-05-15', weekday: 'Friday' },
      { date: '2026-05-16', weekday: 'Saturday' },
      { date: '2026-05-17', weekday: 'Sunday' },
      { date: '2026-05-18', weekday: 'Monday' },
      { date: '2026-05-19', weekday: 'Tuesday' },
      { date: '2026-05-20', weekday: 'Wednesday' },
      { date: '2026-05-21', weekday: 'Thursday' },
    ]);
  });
});
