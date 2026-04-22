import type { VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import type { TEvent } from '@/calendar/types';

import { cva } from 'class-variance-authority';
import { format } from 'date-fns';
import * as React from 'react';
import { EventDetailsDialog } from '@/calendar/components/dialogs/event-details-dialog';
import { DraggableEvent } from '@/calendar/components/dnd/draggable-event';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';
import { cn } from '@/lib/utils/colors-util';

const calendarWeekEventCardVariants = cva(
  'flex select-none flex-col gap-0.5 truncate whitespace-nowrap rounded-md border px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  {
    variants: {
      color: {
        // Colored and mixed variants
        'blue': 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 [&_.event-dot]:fill-blue-600',
        'green': 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300 [&_.event-dot]:fill-green-600',
        'red': 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300 [&_.event-dot]:fill-red-600',
        'yellow': 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 [&_.event-dot]:fill-yellow-600',
        'purple': 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 [&_.event-dot]:fill-purple-600',
        'orange': 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300 [&_.event-dot]:fill-orange-600',
        'gray': 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 [&_.event-dot]:fill-neutral-600',

        // Dot variants
        'blue-dot': 'bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-blue-600',
        'green-dot': 'bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-green-600',
        'red-dot': 'bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-red-600',
        'orange-dot': 'bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-orange-600',
        'purple-dot': 'bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-purple-600',
        'yellow-dot': 'bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-yellow-600',
        'gray-dot': 'bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-neutral-600',
      },
    },
    defaultVariants: {
      color: 'blue-dot',
    },
  },
);

type IProps = {
  event: TEvent;
} & HTMLAttributes<HTMLDivElement> & Omit<VariantProps<typeof calendarWeekEventCardVariants>, 'color'>;

function EventBlockImpl({ event, className, style }: IProps) {
  const badgeVariant = useCalendarViewStore(state => state.badgeVariant);

  // Height and position are now controlled by the style prop

  const colorVariant = (badgeVariant === 'dot' ? `${event.color}-dot` : event.color) as VariantProps<typeof calendarWeekEventCardVariants>['color'];

  const calendarWeekEventCardClasses = cn(calendarWeekEventCardVariants({ color: colorVariant, className }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.click();
      }
    }
  };

  return (
    <DraggableEvent event={event}>
      <EventDetailsDialog event={event}>
        <div
          role="button"
          tabIndex={0}
          className={calendarWeekEventCardClasses}
          style={style}
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-1.5 truncate">
            {['mixed', 'dot'].includes(badgeVariant) && (
              <svg width="8" height="8" viewBox="0 0 8 8" className="event-dot shrink-0">
                <circle cx="4" cy="4" r="4" />
              </svg>
            )}

            <p className="truncate font-semibold">{event.title}</p>
          </div>

          <p>
            {format(new Date(event.startDate), 'h:mm a')}
            {' - '}
            {format(new Date(event.endDate), 'h:mm a')}
          </p>
        </div>
      </EventDetailsDialog>
    </DraggableEvent>
  );
}

export const EventBlock = React.memo(EventBlockImpl);
