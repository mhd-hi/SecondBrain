/* eslint-disable ts/no-explicit-any */
import type { Mock } from 'vitest';
import * as dateFns from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEventEnd, getEventStart } from '../../src/calendar/date-utils';
import {
  formatBadgeDate,
  formatDueDate,
  formatWeekRange,
  getWeekNumberFromDueDate,
} from '../../src/lib/utils/date-util';
import { STANDARD_WEEKS_PER_TERM } from '../../src/lib/utils/term-util';
import { restoreSystemDate, setSystemDate } from '../helpers/runtime';

vi.mock('date-fns', () => {
  const parseIsoLikeDateFns = (value: string) => {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    return new Date(value);
  };

  return {
    parseISO: vi.fn(parseIsoLikeDateFns),
  };
});

const createLocalDate = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12);

describe('date-util', () => {
  beforeEach(() => {
    setSystemDate(createLocalDate(2026, 2, 14));
    (dateFns.parseISO as unknown as Mock).mockImplementation((value: string) => {
      const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

      if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }

      return new Date(value);
    });
  });

  afterEach(() => {
    restoreSystemDate();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('formatWeekRange handles empty and returns a short range', () => {
    expect(formatWeekRange([])).toBe('');

    const dates = [createLocalDate(2026, 2, 14), createLocalDate(2026, 2, 16)];
    const r = formatWeekRange(dates);

    expect(r).toContain(' - ');
  });

  it('formatBadgeDate returns weekday, month and day (en-US)', () => {
    const res = formatBadgeDate(createLocalDate(2026, 2, 14));

    expect(res).toContain('Sat');
    expect(res).toContain('Feb');
    expect(res).toContain('14');
  });

  it('formatWeekRange formats a start-end range', () => {
    const dates = [createLocalDate(2026, 2, 14), createLocalDate(2026, 2, 20)];
    const res = formatWeekRange(dates);

    expect(res).toMatch(/\d{1,2}/);
    expect(res).toContain(' - ');
  });

  it('formatDueDate handles today, tomorrow, future, overdue and invalid', () => {
    expect(formatDueDate(createLocalDate(2026, 2, 14))).toBe('Due today');
    expect(formatDueDate(createLocalDate(2026, 2, 15))).toBe('Due tomorrow');
    expect(formatDueDate(createLocalDate(2026, 2, 17))).toBe('Due in 3 days');
    expect(formatDueDate(createLocalDate(2026, 2, 13))).toBe('Overdue by 1 day');
    expect(formatDueDate(createLocalDate(2026, 2, 11))).toBe('Overdue by 3 days');
    expect(formatDueDate('invalid-date')).toBe('Invalid date');
  });

  it('getWeekNumberFromDueDate returns a valid week number within range', () => {
    const week = getWeekNumberFromDueDate(createLocalDate(2026, 2, 14));

    expect(typeof week).toBe('number');
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(STANDARD_WEEKS_PER_TERM);
  });

  describe('calendar date-utils', () => {
    it('parses ISO start/end and caches the Date objects', () => {
      const ev: any = {
        id: '1',
        startDate: '2026-02-14',
        endDate: '2026-02-15',
        title: 't',
        type: 'task',
        color: 'red',
      };

      const s = getEventStart(ev);
      const e = getEventEnd(ev);

      expect(s).toBeInstanceOf(Date);
      expect(e).toBeInstanceOf(Date);
      expect((ev as any).startDateObj).toBe(s);
      expect((ev as any).endDateObj).toBe(e);
      expect(s.getFullYear()).toBe(2026);
      expect(s.getMonth()).toBe(1);
      expect(s.getDate()).toBe(14);
      expect(e.getFullYear()).toBe(2026);
      expect(e.getMonth()).toBe(1);
      expect(e.getDate()).toBe(15);
    });

    it('returns existing startDateObj/endDateObj when present', () => {
      const start = new Date(2020, 0, 1);
      const end = new Date(2020, 0, 2);

      const ev: any = {
        id: '2',
        startDate: '2020-01-01',
        endDate: '2020-01-02',
        title: 't2',
        type: 'task',
        color: 'blue',
        startDateObj: start,
        endDateObj: end,
      };

      expect(getEventStart(ev)).toBe(start);
      expect(getEventEnd(ev)).toBe(end);
    });

    it('falls back to `new Date` when parseISO throws', () => {
      (dateFns.parseISO as unknown as Mock).mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const ev: any = {
        id: '3',
        startDate: '02/14/2026',
        endDate: '02/15/2026',
        title: 't3',
        type: 'task',
        color: 'green',
      };

      const d = getEventStart(ev);

      expect(d).toBeInstanceOf(Date);
      expect(ev.startDateObj).toBe(d);
    });
  });
});
