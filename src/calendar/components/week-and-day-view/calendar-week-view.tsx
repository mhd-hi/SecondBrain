import type { TEvent } from '@/calendar/types';
import type { Course } from '@/types/course';
import { format, parseISO, startOfWeek } from 'date-fns';
import * as React from 'react';
import { useMemo } from 'react';
import { CalendarTimeline } from '@/calendar/components/week-and-day-view/calendar-time-line';
import { EventBlock } from '@/calendar/components/week-and-day-view/event-block';
import { TimeSlotBlock } from '@/calendar/components/week-and-day-view/time-slot-block';
import { getEventBlockStyle, getEventLayouts, getVisibleHours } from '@/calendar/helpers';
import { eventOverlapsDay, sortEventsByStart } from '@/calendar/selectors';

import { AddTaskDialog } from '@/components/shared/dialogs/AddTaskDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WEEK_VIEW_HOUR_BLOCK_HEIGHT, WEEK_VIEW_SLOT_INTERVAL_MINUTES } from '@/lib/calendar/constants';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';
import { cn } from '@/lib/utils';

type IProps = {
  events: TEvent[];
  courses: Course[];
};

export function CalendarWeekView({ events, courses }: IProps) {
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const selectedDate = useCalendarViewStore(state => state.selectedDate);
  const setSelectedDate = useCalendarViewStore(state => state.setSelectedDate);
  const visibleHours = useCalendarViewStore(state => state.visibleHours);

  const weekDays = useMemo(() => {
    const safeDate = selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime()) ? selectedDate : new Date();
    const weekStart = startOfWeek(safeDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      return day;
    });
  }, [selectedDate]);

  const { hours, earliestEventHour, latestEventHour } = useMemo(
    () => getVisibleHours(visibleHours, events),
    [visibleHours, events],
  );

  // For each day, group events by overlap
  const dayGroups = useMemo(() => {
    return weekDays.map((day) => {
      const dayEvents = sortEventsByStart(events.filter(event => eventOverlapsDay(event, day)));
      return {
        day,
        dayEvents,
        eventLayouts: getEventLayouts(dayEvents),
      };
    });
  }, [weekDays, events]);

  return (
    <>
      <div className="flex flex-col items-center justify-center border-b py-4 text-sm text-muted-foreground sm:hidden">
        <p>Weekly view is not available on smaller devices.</p>
        <p>Please switch to daily or monthly view.</p>
      </div>

      <div className="hidden flex-col sm:flex">
        <div>
          {/* Week header */}
          <div className="relative z-20 flex border-b">
            <div className="w-18"></div>
            <div className="grid flex-1 grid-cols-7 divide-x border-l">
              {weekDays.map((day) => {
                const dayLabel = format(day, 'EE');
                const dayNumber = format(day, 'd');
                return (
                  <span key={day.toISOString()} className="py-2 text-center text-xs font-medium text-muted-foreground">
                    {dayLabel}
                    {' '}
                    <span className="ml-1 font-semibold text-foreground">{dayNumber}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <ScrollArea className="h-full" type="always">
          <div className="flex overflow-hidden">
            {/* Hours column */}
            <div className="relative w-18">
              {hours.map((hour, index) => (
                <div key={hour} className="relative" style={{ height: `${WEEK_VIEW_HOUR_BLOCK_HEIGHT}px` }}>
                  <div className="absolute -top-3 right-2 flex h-6 items-center">
                    {index !== 0 && (() => {
                      const labelDate = new Date();
                      labelDate.setHours(hour, 0, 0, 0);
                      return <span className="text-xs text-muted-foreground">{format(labelDate, 'hh a')}</span>;
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {/* Week grid */}
            <div className="relative flex-1 border-l">
              <div className="grid grid-cols-7 divide-x">
                {dayGroups.map(({ day, dayEvents, eventLayouts }) => {
                  const slotsPerHour = 60 / WEEK_VIEW_SLOT_INTERVAL_MINUTES;
                  const slotHeight = WEEK_VIEW_HOUR_BLOCK_HEIGHT / slotsPerHour;
                  return (
                    <div key={day.toISOString()} className="relative">
                      {hours.map((hour, index) => {
                        const slotMinutes = Array.from({ length: slotsPerHour }, (_, i) => i * WEEK_VIEW_SLOT_INTERVAL_MINUTES);
                        return (
                          <div key={hour} className={cn('relative')} style={{ height: `${WEEK_VIEW_HOUR_BLOCK_HEIGHT}px` }}>
                            {index !== 0 && <div className="pointer-events-none absolute inset-x-0 top-0 border-b"></div>}
                            {slotMinutes.map((minute, i) => {
                              // Calculate the slot's date/time
                              const slotDate = new Date(day);
                              slotDate.setHours(hour, minute, 0, 0);
                              // A slot is occupied if any event overlaps with this slot window
                              const slotEnd = new Date(slotDate.getTime() + WEEK_VIEW_SLOT_INTERVAL_MINUTES * 60 * 1000);
                              const isOccupied = dayEvents.some((event) => {
                                const eventStart = typeof event.startDate === 'string' ? parseISO(event.startDate) : event.startDate;
                                const eventEnd = typeof event.endDate === 'string' ? parseISO(event.endDate) : event.endDate;
                                return eventStart < slotEnd && eventEnd > slotDate;
                              });
                              return (
                                <div key={minute} style={{ position: 'absolute', top: `${i * slotHeight}px`, left: 0, right: 0, height: `${slotHeight}px` }}>
                                  <TimeSlotBlock
                                    date={slotDate}
                                    courses={courses}
                                    isOccupied={isOccupied}
                                    onAddTask={() => {
                                      setSelectedDate(slotDate);
                                      setTaskDialogOpen(true);
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      {eventLayouts.map(({ event, columnCount, columnIndex }) => {
                        const style = getEventBlockStyle(
                          event,
                          day,
                          columnIndex,
                          columnCount,
                          { from: earliestEventHour, to: latestEventHour },
                          WEEK_VIEW_HOUR_BLOCK_HEIGHT,
                          WEEK_VIEW_SLOT_INTERVAL_MINUTES,
                          slotHeight,
                        );
                        return (
                          <EventBlock key={event.id} event={event} className="absolute px-1 py-0.5 text-xs" style={style} />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <CalendarTimeline firstVisibleHour={earliestEventHour} lastVisibleHour={latestEventHour} />
            </div>
          </div>
        </ScrollArea>
      </div>
      <AddTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        courses={courses}
        dueDate={selectedDate ?? new Date('2027-01-01')}
        onTaskAdded={() => setTaskDialogOpen(false)}
        trigger={false}
      />
    </>
  );
}
