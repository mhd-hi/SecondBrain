import type { TEvent } from '@/calendar/types';
import { format, getDaysInMonth, startOfMonth } from 'date-fns';
import { useMemo } from 'react';

import { YearViewDayCell } from '@/calendar/components/year-view/year-view-day-cell';
import { groupEventsByDay } from '@/calendar/selectors';
import { WEEK_DAYS } from '@/lib/calendar/constants';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

type IProps = {
  month: Date;
  events: TEvent[];
};

export function YearViewMonth({ month, events }: IProps) {
  const setView = useCalendarViewStore(state => state.setView);

  const setSelectedDate = useCalendarViewStore(state => state.setSelectedDate);

  const monthName = format(month, 'MMMM');

  const daysInMonth = useMemo(() => {
    const totalDays = getDaysInMonth(month);
    const firstDayOfMonth = startOfMonth(month).getDay();
    // Adjust for Monday-first week: Sunday (0) becomes 6, Monday (1) becomes 0, etc.
    const firstDay = (firstDayOfMonth + 6) % 7;

    const blanks = Array.from({ length: firstDay }, (_, i) => ({ type: 'blank' as const, id: `blank-${i}` }));
    const days = Array.from({ length: totalDays }, (_, i) => ({ type: 'day' as const, day: i + 1, id: `day-${i + 1}` }));

    return [...blanks, ...days];
  }, [month]);

  const dayEventsByDate = useMemo(() => {
    return new Map(
      groupEventsByDay(events).map(group => [format(group.date, 'yyyy-MM-dd'), group.events] as const),
    );
  }, [events]);

  const handleClick = () => {
    setSelectedDate(new Date(month.getFullYear(), month.getMonth(), 1));
    setView('month');
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={handleClick}
        className="w-full rounded-t-lg border px-3 py-2 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {monthName}
      </button>

      <div className="flex-1 space-y-2 rounded-b-lg border border-t-0 p-3">
        <div className="grid grid-cols-7 gap-x-0.5 text-center">
          {WEEK_DAYS.map(day => (
            <div key={day} className="text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-x-0.5 gap-y-2">
          {daysInMonth.map((item) => {
            if (item.type === 'blank') {
              return <div key={item.id} className="h-10" />;
            }

            const date = new Date(month.getFullYear(), month.getMonth(), item.day);
            const dayEvents = dayEventsByDate.get(format(date, 'yyyy-MM-dd')) ?? [];

            return <YearViewDayCell key={item.id} day={item.day} date={date} events={dayEvents} />;
          })}
        </div>
      </div>
    </div>
  );
}
