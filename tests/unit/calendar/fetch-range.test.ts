import { describe, expect, it } from 'vitest';
import { getCalendarFetchRange } from '@/calendar/fetch-range';

describe('getCalendarFetchRange', () => {
  it('uses the selected month for month and agenda views', () => {
    const selectedDate = new Date(2026, 4, 15, 12);

    const monthRange = getCalendarFetchRange(selectedDate, 'month');
    const agendaRange = getCalendarFetchRange(selectedDate, 'agenda');

    expect(monthRange.start.getTime()).toBe(new Date(2026, 3, 24, 0, 0, 0, 0).getTime());
    expect(monthRange.end.getTime()).toBe(new Date(2026, 5, 7, 23, 59, 59, 999).getTime());
    expect(agendaRange).toEqual(monthRange);
  });

  it('covers the full selected year for year view', () => {
    const selectedDate = new Date(2026, 8, 20, 12);

    const range = getCalendarFetchRange(selectedDate, 'year');

    expect(range.start.getTime()).toBe(new Date(2026, 0, 1, 0, 0, 0, 0).getTime());
    expect(range.end.getTime()).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).getTime());
  });

  it('adds a one-week buffer around week view', () => {
    const selectedDate = new Date(2026, 3, 22, 12);

    const range = getCalendarFetchRange(selectedDate, 'week');

    expect(range.start.getTime()).toBe(new Date(2026, 3, 13, 0, 0, 0, 0).getTime());
    expect(range.end.getTime()).toBe(new Date(2026, 4, 3, 23, 59, 59, 999).getTime());
  });
});
