'use client';

import type { Task } from '@/types/task';
import { useDrop } from 'react-dnd';
import { KANBAN_ITEM_TYPE, KanbanCard } from '@/components/Kanban/KanbanCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/colors-util';
import type { StatusTask } from '@/types/status-task';

type KanbanColumnProps = {
  status: StatusTask;
  title: string;
  accentClass: string;
  tasks: Task[];
  onDropTask: (taskId: string, status: StatusTask) => void;
};

export function KanbanColumn({
  status,
  title,
  accentClass,
  tasks,
  onDropTask,
}: KanbanColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: KANBAN_ITEM_TYPE,
    drop: (item: { taskId: string }) => {
      onDropTask(item.taskId, status);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }));

  const dropRef = (node: HTMLDivElement | null) => {
    drop(node);
  };

  return (
    <div
      ref={dropRef}
      className={cn(
        'bg-muted/30 flex h-full max-h-full min-w-[18rem] flex-1 basis-0 flex-col overflow-hidden rounded-xl border transition-colors select-none',
        isOver && 'border-primary bg-primary/5',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', accentClass)} />
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        </div>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div className="kanban-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pl-3 pt-3 pb-3" style={{ paddingRight: '0.5px' }}>
        {tasks.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed text-xs">
            Drop tasks here
          </div>
        ) : (
          tasks.map((task) => <KanbanCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
