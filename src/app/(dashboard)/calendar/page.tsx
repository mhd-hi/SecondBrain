'use client';

import type { TCalendarView } from '@/calendar/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { CalendarWrapper } from '@/components/Calendar/CalendarWrapper';
import { useCalendarTasks } from '@/hooks/task/use-task';
import { getCalendarPath } from '@/lib/page-routes';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

const VALID_VIEWS: TCalendarView[] = ['day', 'week', 'month', 'year', 'agenda'];

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getCalendarTasks, isLoading: _isLoading, error } = useCalendarTasks();
  const setStoreEvents = useCalendarViewStore(state => state.setEvents);
  const view = useCalendarViewStore(state => state.view);
  const setView = useCalendarViewStore(state => state.setView);
  const isInitializedRef = useRef(false);

  // Initialize view from URL parameter on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      const viewParam = searchParams.get('view');
      if (viewParam && VALID_VIEWS.includes(viewParam as TCalendarView)) {
        setView(viewParam as TCalendarView);
      } else if (!viewParam) {
        // Set default view in URL if not present
        router.replace(getCalendarPath(view), { scroll: false });
      }
    }
  }, [searchParams, setView, view, router]);

  // Update URL when view changes in store
  useEffect(() => {
    const currentViewParam = searchParams.get('view');
    if (currentViewParam !== view) {
      router.replace(getCalendarPath(view), { scroll: false });
    }
  }, [view, router, searchParams]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Fetch events for a wider range to ensure we get all relevant events
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // 30 days ago
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 days from now

        const fetchedEvents = await getCalendarTasks(startDate, endDate);
        setStoreEvents(fetchedEvents);
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
      }
    };

    fetchEvents();
  }, [getCalendarTasks, setStoreEvents]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600">Error loading calendar</h2>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
  <div className="h-full mx-6 flex flex-col">
      <div className="flex-1 min-h-0">
        <CalendarWrapper />
      </div>
  </div>
  );
}
