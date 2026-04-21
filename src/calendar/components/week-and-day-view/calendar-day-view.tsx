import type { TEvent } from '@/calendar/types';
import { format, parseISO } from 'date-fns';

import { Calendar, Clock } from 'lucide-react';

import { CalendarTimeline } from '@/calendar/components/week-and-day-view/calendar-time-line';
import { EventBlock } from '@/calendar/components/week-and-day-view/event-block';
import { getCurrentEvents, getEventBlockStyle, getEventLayouts, getVisibleHours } from '@/calendar/helpers';
import { eventOverlapsDay, sortEventsByStart } from '@/calendar/selectors';
import { ScrollArea } from '@/components/ui/scroll-area';

import { SingleCalendar } from '@/components/ui/single-calendar';
import { DAY_VIEW_HOUR_BLOCK_HEIGHT } from '@/lib/calendar/constants';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

import { cn } from '@/lib/utils/colors-util';

type IProps = {
  events: TEvent[];
};

export function CalendarDayView({ events }: IProps) {
  const visibleHours = useCalendarViewStore(state => state.visibleHours);
  const selectedDate = useCalendarViewStore(state => state.selectedDate);
  const setSelectedDate = useCalendarViewStore(state => state.setSelectedDate);
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const dayEvents = sortEventsByStart(events.filter(event => eventOverlapsDay(event, selectedDate)));

  const { hours, earliestEventHour, latestEventHour } = getVisibleHours(visibleHours, dayEvents);
  const currentEvents = getCurrentEvents(dayEvents);
  const eventLayouts = getEventLayouts(dayEvents);

  return (
    <div className="flex">
      <div className="flex flex-1 flex-col min-h-0">
        <div>
          {/* Day header */}
          <div className="relative z-20 flex border-b">
            <div className="w-18"></div>
            <span className="flex-1 border-l py-2 text-center text-xs font-medium text-muted-foreground">
              {format(selectedDate, 'EE')}
              {' '}
              <span className="font-semibold text-foreground">
                {format(selectedDate, 'd')}
              </span>
            </span>
          </div>
        </div>
  <ScrollArea className="flex-1 min-h-0 overflow-y-auto" type="auto">
          <div className="flex">
            {/* Hours column */}
            <div className="relative w-18">
              {hours.map((hour, index) => (
                <div key={hour} className="relative" style={{ height: `${DAY_VIEW_HOUR_BLOCK_HEIGHT}px` }}>
                  <div className="absolute -top-3 right-2 flex h-6 items-center">
                    {index !== 0 && <span className="text-xs text-muted-foreground">{format(new Date().setHours(hour, 0, 0, 0), 'hh a')}</span>}
                  </div>
                </div>
              ))}
            </div>
            {/* Day grid */}
            <div className="relative flex-1 border-l">
              <div className="relative">
                {hours.map((hour) => {
                  return (
                    <div key={hour} className={cn('relative')} style={{ height: `${DAY_VIEW_HOUR_BLOCK_HEIGHT}px` }}>
                      <div className="pointer-events-none absolute inset-x-0 top-0 border-b"></div>
                      {/* ...existing code... */}
                    </div>
                  );
                })}
                {eventLayouts.map(({ event, columnCount, columnIndex }) => {
                    const style = getEventBlockStyle(
                      event,
                      selectedDate,
                      columnIndex,
                      columnCount,
                      { from: earliestEventHour, to: latestEventHour },
                    );
                    return (
                      <div key={event.id} className="absolute p-1" style={style}>
                        <EventBlock event={event} />
                      </div>
                    );
                  })}
              </div>
              <CalendarTimeline firstVisibleHour={earliestEventHour} lastVisibleHour={latestEventHour} />
            </div>
          </div>
  </ScrollArea>
      </div>
      <div className="hidden w-64 min-h-0 divide-y border-l md:flex md:flex-col">
        <SingleCalendar className="mx-auto w-fit" mode="single" selected={selectedDate} onSelect={handleSelect} initialFocus />
        <div className="flex-1 space-y-3 min-h-0">
          {currentEvents.length > 0
            ? (
              <div className="flex items-start gap-2 px-4 pt-4">
                <span className="relative mt-1.25 flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex size-2.5 rounded-full bg-green-600"></span>
                </span>
                <p className="text-sm font-semibold text-foreground">Happening now</p>
              </div>
            )
            : (
              <p className="p-4 text-center text-sm italic text-muted-foreground">No tasks</p>
            )}
          {currentEvents.length > 0 && (
            <ScrollArea className="h-105.5 px-4" type="always">
              <div className="space-y-6 pb-4">
                {currentEvents.map(event => (
                  <div key={event.id} className="space-y-1.5">
                    <p className="line-clamp-2 text-sm font-semibold">{event.title}</p>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-3.5" />
                      <span className="text-sm">{format(new Date(), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span className="text-sm">
                        {format(parseISO(event.startDate), 'h:mm a')}
                        {' '}
                        -
                        {format(parseISO(event.endDate), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
