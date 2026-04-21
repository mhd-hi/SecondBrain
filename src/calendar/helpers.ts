import type { TCalendarCell, TEvent, TVisibleHours } from '@/calendar/types';

import {
  differenceInMinutes,
  isWithinInterval,
} from 'date-fns';
import { getEventEnd, getEventStart } from '@/calendar/date-utils';
import { VISIBLE_HOURS } from '@/lib/calendar/constants';

// ================ Week and day view helper functions ================ //
export function getCurrentEvents(events: TEvent[]) {
  const now = new Date();
  return events.filter(event => isWithinInterval(now, { start: getEventStart(event), end: getEventEnd(event) })) || null;
}

export type EventLayout = {
  event: TEvent;
  columnCount: number;
  columnIndex: number;
};

function getClusterEventLayouts(clusterEvents: TEvent[]): EventLayout[] {
  if (clusterEvents.length === 0) {
    return [];
  }

  const columnEndTimes: Date[] = [];
  const layouts: Array<Pick<EventLayout, 'event' | 'columnIndex'>> = [];

  for (const event of clusterEvents) {
    const eventStart = getEventStart(event);
    const availableColumnIndex = columnEndTimes.findIndex(endTime => eventStart >= endTime);
    const columnIndex = availableColumnIndex === -1 ? columnEndTimes.length : availableColumnIndex;

    columnEndTimes[columnIndex] = getEventEnd(event);
    layouts.push({ event, columnIndex });
  }

  const columnCount = Math.max(columnEndTimes.length, 1);
  return layouts.map(layout => ({ ...layout, columnCount }));
}

export function getEventLayouts(dayEvents: TEvent[]) {
  const sortedEvents = [...dayEvents].sort((a, b) => getEventStart(a).getTime() - getEventStart(b).getTime());
  const layouts: EventLayout[] = [];
  let currentCluster: TEvent[] = [];
  let currentClusterEnd: Date | null = null;

  for (const event of sortedEvents) {
    const eventStart = getEventStart(event);
    const eventEnd = getEventEnd(event);

    if (currentClusterEnd && eventStart >= currentClusterEnd) {
      layouts.push(...getClusterEventLayouts(currentCluster));
      currentCluster = [];
      currentClusterEnd = null;
    }

    currentCluster.push(event);

    if (!currentClusterEnd || eventEnd > currentClusterEnd) {
      currentClusterEnd = eventEnd;
    }
  }

  layouts.push(...getClusterEventLayouts(currentCluster));
  return layouts;
}

export function getEventBlockStyle(
  event: TEvent,
  day: Date,
  groupIndex: number,
  groupSize: number,
  visibleHoursRange?: { from: number; to: number },
  hourBlockHeight = 64,
  slotIntervalMinutes = 30,
  slotHeight = 32,
) {
  const startDate = getEventStart(event);
  const endDate = getEventEnd(event);
  const dayStart = new Date(day.setHours(0, 0, 0, 0));
  const eventStart = startDate < dayStart ? dayStart : startDate;
  const startMinutes = differenceInMinutes(eventStart, dayStart);
  const endMinutes = differenceInMinutes(endDate, dayStart);
  let top;
  let height;
  if (visibleHoursRange) {
    const visibleStartMinutes = visibleHoursRange.from * 60;
    // Calculate how many slots from the visible start to the event start
    const slotIndex = Math.floor((startMinutes - visibleStartMinutes) / slotIntervalMinutes);
    const slotOffset = (startMinutes - visibleStartMinutes) % slotIntervalMinutes;
    top = slotIndex * slotHeight + (slotOffset / slotIntervalMinutes) * slotHeight;
    // Calculate event duration in slots
    const duration = endMinutes - startMinutes;
    const slotCount = Math.floor(duration / slotIntervalMinutes);
    const slotRemainder = duration % slotIntervalMinutes;
    height = slotCount * slotHeight + (slotRemainder / slotIntervalMinutes) * slotHeight;
  } else {
    // Fallback for all-day or agenda views
    top = (startMinutes / 1440) * (hourBlockHeight * 24 / 60);
    height = ((endMinutes - startMinutes) / 1440) * (hourBlockHeight * 24 / 60);
  }
  const width = 100 / groupSize;
  const left = groupIndex * width;
  return { top: `${top}px`, height: `${height}px`, width: `${width}%`, left: `${left}%` };
}

export function getVisibleHours(visibleHours: TVisibleHours | undefined, singleDayEvents: TEvent[]) {
  const defaultVisible = VISIBLE_HOURS;
  const vh = visibleHours ?? defaultVisible;

  let earliestEventHour = typeof vh.from === 'number' ? vh.from : defaultVisible.from;
  let latestEventHour = typeof vh.to === 'number' ? vh.to : defaultVisible.to;

  singleDayEvents.forEach((event) => {
    try {
      const start = getEventStart(event);
      const endTime = getEventEnd(event);

      if (Number.isNaN(start.getTime()) || Number.isNaN(endTime.getTime())) {
        return;
      }

      const startHour = start.getHours();
      const endHour = endTime.getHours() + (endTime.getMinutes() > 0 ? 1 : 0);

      if (startHour < earliestEventHour) {
        earliestEventHour = startHour;
      }
      if (endHour > latestEventHour) {
        latestEventHour = endHour;
      }
    } catch {
      // ignore malformed dates
    }
  });

  latestEventHour = Math.min(latestEventHour, 24);

  const hours = Array.from({ length: latestEventHour - earliestEventHour }, (_, i) => i + earliestEventHour);

  return { hours, earliestEventHour, latestEventHour };
}

// ================ Month view helper functions ================ //
export function getCalendarCells(selectedDate: Date): TCalendarCell[] {
  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth();

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  // getDay() returns 0 (Sunday) to 6 (Saturday). For Monday-first, treat 0 as 6, 1 as 0, ..., 6 as 5
  const getMondayFirstDay = (date: Date) => {
    const day = date.getDay();
    return (day + 6) % 7;
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getMondayFirstDay(new Date(currentYear, currentMonth, 1));
  const daysInPrevMonth = getDaysInMonth(currentYear, currentMonth - 1);
  const totalDays = firstDayOfMonth + daysInMonth;

  const prevMonthCells = Array.from({ length: firstDayOfMonth }, (_, i) => ({
    day: daysInPrevMonth - firstDayOfMonth + i + 1,
    currentMonth: false,
    date: new Date(currentYear, currentMonth - 1, daysInPrevMonth - firstDayOfMonth + i + 1),
  }));

  const currentMonthCells = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    currentMonth: true,
    date: new Date(currentYear, currentMonth, i + 1),
  }));

  const nextMonthCells = Array.from({ length: (7 - (totalDays % 7)) % 7 }, (_, i) => ({
    day: i + 1,
    currentMonth: false,
    date: new Date(currentYear, currentMonth + 1, i + 1),
  }));

  return [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];
}
