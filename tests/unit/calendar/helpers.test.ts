import type { TEvent } from '@/calendar/types';
import { describe, expect, it } from 'vitest';
import { getEventBlockStyle, getEventLayouts } from '@/calendar/helpers';

function createEvent(overrides: Partial<TEvent> & Pick<TEvent, 'id' | 'startDate' | 'endDate'>): TEvent {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    type: 'task',
    color: overrides.color ?? 'green',
    description: overrides.description,
    courseCode: overrides.courseCode,
    courseId: overrides.courseId,
    secondaryColor: overrides.secondaryColor,
  };
}

describe('calendar helpers', () => {
  it('gives disconnected later events the full width of their own cluster', () => {
    const morningLeft = createEvent({
      id: 'morning-left',
      startDate: '2026-01-10T09:00:00',
      endDate: '2026-01-10T12:00:00',
    });
    const morningRight = createEvent({
      id: 'morning-right',
      startDate: '2026-01-10T09:00:00',
      endDate: '2026-01-10T12:00:00',
    });
    const evening = createEvent({
      id: 'evening',
      startDate: '2026-01-10T18:00:00',
      endDate: '2026-01-10T21:00:00',
    });

    const layouts = getEventLayouts([morningLeft, morningRight, evening]);
    const eveningLayout = layouts.find(layout => layout.event.id === 'evening');

    expect(eveningLayout).toMatchObject({
      columnCount: 1,
      columnIndex: 0,
    });

    const eveningStyle = getEventBlockStyle(evening, new Date(2026, 0, 10), eveningLayout!.columnIndex, eveningLayout!.columnCount);

    expect(eveningStyle.width).toBe('100%');
    expect(eveningStyle.left).toBe('0%');
  });

  it('keeps staggered overlapping events within the same shared-width cluster', () => {
    const longEvent = createEvent({
      id: 'long',
      startDate: '2026-01-10T09:00:00',
      endDate: '2026-01-10T12:00:00',
    });
    const earlyShort = createEvent({
      id: 'early-short',
      startDate: '2026-01-10T09:00:00',
      endDate: '2026-01-10T10:00:00',
    });
    const lateShort = createEvent({
      id: 'late-short',
      startDate: '2026-01-10T10:00:00',
      endDate: '2026-01-10T11:00:00',
    });

    const layouts = getEventLayouts([longEvent, earlyShort, lateShort]);

    expect(layouts).toEqual([
      expect.objectContaining({ event: longEvent, columnIndex: 0, columnCount: 2 }),
      expect.objectContaining({ event: earlyShort, columnIndex: 1, columnCount: 2 }),
      expect.objectContaining({ event: lateShort, columnIndex: 1, columnCount: 2 }),
    ]);
  });
});
