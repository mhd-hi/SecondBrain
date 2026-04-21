'use client';

import type { TCalendarView } from '@/calendar/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCalendarEventsSync } from '@/calendar/hooks/use-calendar-events-sync';
import { CalendarWrapper } from '@/components/Calendar/CalendarWrapper';
import { getCalendarPath } from '@/lib/page-routes';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

const VALID_VIEWS: TCalendarView[] = ['day', 'week', 'month', 'year', 'agenda'];

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { error } = useCalendarEventsSync();
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
