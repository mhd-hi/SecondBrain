import type { TEvent } from '@/calendar/types';
import { describe, expect, it } from 'vitest';
import { eventOverlapsDay, groupEventsByDay, sortEventsByStart } from '@/calendar/selectors';

function createEvent(overrides: Partial<TEvent> & Pick<TEvent, 'id' | 'startDate' | 'endDate'>): TEvent {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    type: 'task',
    color: overrides.color ?? 'red',
    description: overrides.description,
    courseCode: overrides.courseCode,
    courseId: overrides.courseId,
    secondaryColor: overrides.secondaryColor,
  };
}

describe('calendar selectors', () => {
  it('sorts events by start date without mutating the original array', () => {
    const laterEvent = createEvent({
      id: 'later',
      startDate: '2026-03-12T13:00:00.000Z',
      endDate: '2026-03-12T14:00:00.000Z',
    });
    const earlierEvent = createEvent({
      id: 'earlier',
      startDate: '2026-03-12T09:00:00.000Z',
      endDate: '2026-03-12T10:00:00.000Z',
    });
    const events = [laterEvent, earlierEvent];

    const sortedEvents = sortEventsByStart(events);

    expect(sortedEvents.map(event => event.id)).toEqual(['earlier', 'later']);
    expect(events.map(event => event.id)).toEqual(['later', 'earlier']);
  });

  it('treats events spanning midnight as overlapping each covered day only', () => {
    const overnightEvent = createEvent({
      id: 'overnight',
      startDate: '2026-03-12T23:00:00',
      endDate: '2026-03-13T02:00:00',
    });

    expect(eventOverlapsDay(overnightEvent, new Date(2026, 2, 12, 12))).toBe(true);
    expect(eventOverlapsDay(overnightEvent, new Date(2026, 2, 13, 12))).toBe(true);
    expect(eventOverlapsDay(overnightEvent, new Date(2026, 2, 14, 12))).toBe(false);
  });

  it('groups events by each overlapping day and keeps each day sorted', () => {
    const multiDayEvent = createEvent({
      id: 'multi-day',
      startDate: '2026-03-12T23:00:00',
      endDate: '2026-03-14T01:00:00',
    });
    const morningEvent = createEvent({
      id: 'morning',
      startDate: '2026-03-13T08:00:00',
      endDate: '2026-03-13T09:00:00',
    });
    const lateEvent = createEvent({
      id: 'late',
      startDate: '2026-03-13T18:00:00',
      endDate: '2026-03-13T19:00:00',
    });

    const groupedEvents = groupEventsByDay([lateEvent, multiDayEvent, morningEvent]);

    expect(groupedEvents.map(group => group.date.toISOString().slice(0, 10))).toEqual([
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
    ]);
    expect(groupedEvents[0]?.events.map(event => event.id)).toEqual(['multi-day']);
    expect(groupedEvents[1]?.events.map(event => event.id)).toEqual(['multi-day', 'morning', 'late']);
    expect(groupedEvents[2]?.events.map(event => event.id)).toEqual(['multi-day']);
  });
});
