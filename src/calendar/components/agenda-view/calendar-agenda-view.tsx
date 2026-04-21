import type { TEvent } from '@/calendar/types';
import { format, isSameMonth } from 'date-fns';
import { CalendarX2 } from 'lucide-react';

import { useMemo } from 'react';

import { AgendaDayGroup } from '@/calendar/components/agenda-view/agenda-day-group';
import { groupEventsByDay } from '@/calendar/selectors';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

type Props = {
  events: TEvent[];
};

export function CalendarAgendaView({ events }: Props) {
  const selectedDate = useCalendarViewStore(state => state.selectedDate);

  const eventsByDay = useMemo(() => {
    return groupEventsByDay(events).filter(dayGroup => isSameMonth(dayGroup.date, selectedDate));
  }, [events, selectedDate]);

  const hasAnyEvents = eventsByDay.length > 0;

  return (
    <div>
      <ScrollArea className="h-full" type="always">
        <div className="space-y-6 p-4">
          {eventsByDay.map(dayGroup => (
            <AgendaDayGroup key={format(dayGroup.date, 'yyyy-MM-dd')} date={dayGroup.date} events={dayGroup.events} />
          ))}

          {!hasAnyEvents && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <CalendarX2 className="size-10" />
              <p className="text-sm md:text-base">No events scheduled for the selected month</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
