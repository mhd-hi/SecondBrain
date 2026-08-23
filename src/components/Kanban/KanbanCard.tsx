'use client';

import type { Task } from '@/types/task';
import { CalendarDays, Clock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { EventDetailsDialog } from '@/calendar/components/dialogs/event-details-dialog';
import { taskToEvent } from '@/calendar/event-utils';
import { CourseCodeBadge } from '@/components/shared/atoms/CourseCodeBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/colors-util';
import { formatBadgeDate } from '@/lib/utils/date-util';
import { formatEffortTime } from '@/lib/utils/task/task-util';

export const KANBAN_ITEM_TYPE = 'kanban-task';

type KanbanCardProps = {
  task: Task;
};

export function KanbanCard({ task }: KanbanCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: KANBAN_ITEM_TYPE,
    item: { taskId: task.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  drag(ref);

  return (
    <EventDetailsDialog event={taskToEvent(task)}>
      <div
        ref={ref}
        className={cn(
          'bg-card hover:border-primary/40 cursor-grab rounded-lg border p-3 shadow-sm transition-colors select-none active:cursor-grabbing',
          isDragging && 'opacity-30',
        )}
        data-task-id={task.id}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-foreground text-sm leading-snug font-medium">
            {task.title}
          </p>
          {task.course && (
            <CourseCodeBadge course={task.course} className="shrink-0" />
          )}
        </div>

        {task.notes && (
          <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">
            {task.notes}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted" className="h-6 gap-1">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatBadgeDate(new Date(task.dueDate))}
          </Badge>
          {task.estimatedEffort > 0 && (
            <Badge variant="muted" className="h-6 gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {formatEffortTime(task.estimatedEffort)}
            </Badge>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <Badge variant="muted" className="h-6">
              {task.subtasks.length} subtasks
            </Badge>
          )}
        </div>
      </div>
    </EventDetailsDialog>
  );
}
