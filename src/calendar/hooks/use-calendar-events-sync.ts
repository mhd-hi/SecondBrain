import { useEffect, useMemo } from 'react';
import { getCalendarFetchRange } from '@/calendar/fetch-range';
import { useCalendarTasks } from '@/hooks/task/use-task';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

export function useCalendarEventsSync() {
  const { error, getCalendarTasks, isLoading } = useCalendarTasks();
  const refreshVersion = useCalendarViewStore(state => state.refreshVersion);
  const selectedDate = useCalendarViewStore(state => state.selectedDate);
  const setEvents = useCalendarViewStore(state => state.setEvents);
  const setVisibleRange = useCalendarViewStore(state => state.setVisibleRange);
  const view = useCalendarViewStore(state => state.view);

  const fetchRange = useMemo(
    () => getCalendarFetchRange(selectedDate, view),
    [selectedDate, view],
  );

  useEffect(() => {
    setVisibleRange(fetchRange);
  }, [fetchRange, setVisibleRange]);

  useEffect(() => {
    let isCancelled = false;

    const syncCalendarEvents = async () => {
      try {
        const fetchedEvents = await getCalendarTasks(fetchRange.start, fetchRange.end);
        if (!isCancelled) {
          setEvents(fetchedEvents);
        }
      } catch (fetchError) {
        if (!isCancelled) {
          console.error('Failed to fetch calendar events:', fetchError);
        }
      }
    };

    void syncCalendarEvents();

    return () => {
      isCancelled = true;
    };
  }, [fetchRange, getCalendarTasks, refreshVersion, setEvents]);

  return { error, isLoading };
}
