import type { TCalendarView } from '@/calendar/types';
import {
  addDays,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subWeeks,
} from 'date-fns';

type CalendarFetchRange = {
  end: Date;
  start: Date;
};

function getSafeDate(selectedDate: Date) {
  return selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())
    ? selectedDate
    : new Date();
}

export function getCalendarFetchRange(selectedDate: Date, view: TCalendarView): CalendarFetchRange {
  const safeDate = getSafeDate(selectedDate);

  switch (view) {
    case 'day':
      return {
        start: startOfDay(subDays(safeDate, 7)),
        end: endOfDay(addDays(safeDate, 7)),
      };
    case 'week': {
      const weekStart = startOfWeek(safeDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(safeDate, { weekStartsOn: 1 });
      return {
        start: startOfDay(subWeeks(weekStart, 1)),
        end: endOfDay(addWeeks(weekEnd, 1)),
      };
    }
    case 'month':
    case 'agenda':
      return {
        start: startOfDay(subDays(startOfMonth(safeDate), 7)),
        end: endOfDay(addDays(endOfMonth(safeDate), 7)),
      };
    case 'year':
      return {
        start: startOfDay(startOfYear(safeDate)),
        end: endOfDay(endOfYear(safeDate)),
      };
    default:
      return {
        start: startOfDay(subDays(safeDate, 30)),
        end: endOfDay(addDays(safeDate, 30)),
      };
  }
}
