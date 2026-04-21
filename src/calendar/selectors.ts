import type { TEvent } from '@/calendar/types';
import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import { getEventEnd, getEventStart } from '@/calendar/date-utils';

export type CalendarDayGroup<TEventType extends TEvent = TEvent> = {
  date: Date;
  events: TEventType[];
};

export function sortEventsByStart<TEventType extends TEvent>(events: readonly TEventType[]) {
  return [...events].sort((left, right) => getEventStart(left).getTime() - getEventStart(right).getTime());
}

export function eventOverlapsDay(event: TEvent, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return getEventStart(event) < dayEnd && getEventEnd(event) > dayStart;
}

export function groupEventsByDay<TEventType extends TEvent>(events: readonly TEventType[]): CalendarDayGroup<TEventType>[] {
  const eventsByDay = new Map<string, CalendarDayGroup<TEventType>>();

  for (const event of sortEventsByStart(events)) {
    const startDate = startOfDay(getEventStart(event));
    const endDate = startOfDay(getEventEnd(event));

    for (let currentDate = startDate; currentDate <= endDate; currentDate = addDays(currentDate, 1)) {
      if (!eventOverlapsDay(event, currentDate)) {
        continue;
      }

      const date = startOfDay(currentDate);
      const dateKey = format(date, 'yyyy-MM-dd');
      const existingGroup = eventsByDay.get(dateKey);

      if (existingGroup) {
        existingGroup.events.push(event);
        continue;
      }

      eventsByDay.set(dateKey, { date, events: [event] });
    }
  }

  return Array.from(eventsByDay.values())
    .map(group => ({
      ...group,
      events: sortEventsByStart(group.events),
    }))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}
