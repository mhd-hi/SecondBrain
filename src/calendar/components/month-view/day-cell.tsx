import type { TCalendarCell, TEvent } from '@/calendar/types';
import { isToday, startOfDay } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { DroppableDayCell } from '@/calendar/components/dnd/droppable-day-cell';

import { EventBullet } from '@/calendar/components/month-view/event-bullet';
import { MonthEventBadge } from '@/calendar/components/month-view/month-event-badge';
import { eventOverlapsDay, sortEventsByStart } from '@/calendar/selectors';
import { getCalendarPath } from '@/lib/page-routes';

import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

import { cn } from '@/lib/utils/colors-util';

type IProps = {
  cell: TCalendarCell;
  events: TEvent[];
};

const MAX_VISIBLE_EVENTS = 3;

export function DayCell({ cell, events }: IProps) {
  const { push } = useRouter();
  const setSelectedDate = useCalendarViewStore(state => state.setSelectedDate);

  const { day, currentMonth, date } = cell;

  const cellEvents = useMemo(
    () => sortEventsByStart(events.filter(event => eventOverlapsDay(event, date))),
    [date, events],
  );
  const isSunday = date.getDay() === 0;

  const handleClick = () => {
    setSelectedDate(date);
    push(getCalendarPath());
  };

  return (
    <DroppableDayCell cell={cell}>
      <div className={cn('flex h-full flex-col gap-1 border-l border-t py-1.5 lg:pb-2 lg:pt-1', isSunday && 'border-l-0')}>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'flex size-6 translate-x-1 items-center justify-center rounded-full text-xs font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:px-2',
            !currentMonth && 'opacity-20',
            isToday(date) && 'bg-primary font-bold text-primary-foreground hover:bg-primary',
          )}
        >
          {day}
        </button>

        <div className={cn('flex h-6 gap-1 px-2 lg:h-23.5 lg:flex-col lg:gap-2 lg:px-0', !currentMonth && 'opacity-50')}>
          {cellEvents.slice(0, MAX_VISIBLE_EVENTS).map((event, idx) => {
            const eventKey = `event-${event.id}-${idx}`;
            return (
              <div key={eventKey} className="lg:flex-1">
                <>
                  <EventBullet className="lg:hidden" color={event.color} />
                  <MonthEventBadge className="hidden lg:flex" event={event} cellDate={startOfDay(date)} />
                </>
              </div>
            );
          })}
        </div>

        {cellEvents.length > MAX_VISIBLE_EVENTS && (
          <p className={cn('h-4.5 px-1.5 text-xs font-semibold text-muted-foreground', !currentMonth && 'opacity-50')}>
            <span className="sm:hidden">
              +
              {cellEvents.length - MAX_VISIBLE_EVENTS}
            </span>
            <span className="hidden sm:inline">
              {' '}
              {cellEvents.length - MAX_VISIBLE_EVENTS}
              {' '}
              more...
            </span>
          </p>
        )}
      </div>
    </DroppableDayCell>
  );
}
