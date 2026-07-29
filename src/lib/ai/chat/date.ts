import { getDatesForTerm } from '@/lib/utils/term-util';

const TORONTO_TIME_ZONE = 'America/Toronto';
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TORONTO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

function partsAt(date: Date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour', number>;
}

export function torontoDateAtHour(dateOnly: string, hour: number) {
  if (!dateOnlyPattern.test(dateOnly) || hour < 0 || hour > 23) {
    throw new Error('Invalid Toronto date');
  }

  const [year, month, day] = dateOnly.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const wallClock = Date.UTC(year, month - 1, day, hour);
  const probe = new Date(wallClock);
  const displayed = partsAt(probe);
  const offset =
    Date.UTC(
      displayed.year,
      displayed.month - 1,
      displayed.day,
      displayed.hour,
    ) - wallClock;
  const result = new Date(wallClock - offset);
  const verified = partsAt(result);

  if (
    verified.year !== year ||
    verified.month !== month ||
    verified.day !== day ||
    verified.hour !== hour
  ) {
    throw new Error('Invalid Toronto date');
  }

  return result;
}

export function parseTorontoDueDate(dateOnly: string) {
  return torontoDateAtHour(dateOnly, 12);
}

export function formatTorontoDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addDateOnlyDays(dateOnly: string, days: number) {
  if (!dateOnlyPattern.test(dateOnly)) {
    throw new Error('Invalid Toronto date');
  }
  torontoDateAtHour(dateOnly, 12);
  const [year, month, day] = dateOnly.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function calendarDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function resolveTermWeekDates(term: string, week: number) {
  if (!Number.isInteger(week) || week < 1 || week > 13) {
    throw new Error('Invalid course week');
  }
  const start = new Date(getDatesForTerm(term).start);
  start.setDate(start.getDate() + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const dateOnly = calendarDate(date);
    return {
      date: dateOnly,
      weekday: new Intl.DateTimeFormat('en-CA', {
        weekday: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${dateOnly}T12:00:00Z`)),
    };
  });
}
