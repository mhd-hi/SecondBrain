'use client';

import type { Task } from '@/types/task';
import * as React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { KanbanColumn } from '@/components/Kanban/KanbanColumn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTaskStore } from '@/lib/stores/task-store';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { updateTaskStatus } from '@/hooks/task/use-task';
import { StatusTask } from '@/types/status-task';

const COLUMNS: Array<{
  status: StatusTask;
  title: string;
  accentClass: string;
}> = [
  { status: StatusTask.TODO, title: 'TODO', accentClass: 'bg-blue-500' },
  {
    status: StatusTask.IN_PROGRESS,
    title: 'IN PROGRESS',
    accentClass: 'bg-amber-500',
  },
  {
    status: StatusTask.COMPLETED,
    title: 'COMPLETED',
    accentClass: 'bg-green-500',
  },
];

function KanbanBoardContent() {
  const [taskIds, setTaskIds] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const tasks = useTaskStore(
    useShallow((state) =>
      taskIds.flatMap((taskId) => {
        const task = state.tasks.get(taskId);
        return task ? [task] : [];
      }),
    ),
  );

  const fetchAllTasks = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allTasks = await api.get<Task[]>(
        API_ENDPOINTS.TASKS.ALL,
        'Failed to fetch tasks',
      );
      useTaskStore.getState().setTasks(allTasks);
      setTaskIds(allTasks.map((task) => task.id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch tasks';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchAllTasks();
  }, [fetchAllTasks]);

  const tasksByStatus = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const grouped: Record<StatusTask, Task[]> = {
      [StatusTask.TODO]: [],
      [StatusTask.IN_PROGRESS]: [],
      [StatusTask.COMPLETED]: [],
    };
    for (const task of tasks) {
      if (normalizedQuery && !task.title.toLocaleLowerCase().includes(normalizedQuery)) {
        continue;
      }
      grouped[task.status]?.push(task);
    }

    for (const statusTasks of Object.values(grouped)) {
      statusTasks.sort((left, right) => {
        const leftTime = new Date(left.dueDate).getTime();
        const rightTime = new Date(right.dueDate).getTime();
        const leftInvalid = Number.isNaN(leftTime);
        const rightInvalid = Number.isNaN(rightTime);

        if (leftInvalid || rightInvalid) {
          if (leftInvalid !== rightInvalid) {
            return leftInvalid ? 1 : -1;
          }
          return left.title.localeCompare(right.title);
        }

        const dateOrder = sortDirection === 'asc' ? leftTime - rightTime : rightTime - leftTime;
        return dateOrder || left.title.localeCompare(right.title);
      });
    }

    return grouped;
  }, [query, sortDirection, tasks]);

  const handleDropTask = React.useCallback(
    async (taskId: string, newStatus: StatusTask) => {
      const store = useTaskStore.getState();
      const original = store.getTask(taskId);
      if (!original || original.status === newStatus) {
        return;
      }

      try {
        await updateTaskStatus(taskId, newStatus);
      } catch {
        toast.error('Failed to update task status');
      }
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 gap-4 overflow-x-auto overflow-y-hidden pb-2">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            className="bg-muted/40 h-full animate-pulse rounded-xl"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-destructive text-lg font-semibold">
          Error loading board
        </h2>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" onClick={() => void fetchAllTasks()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-4">
      <div className="flex shrink-0 gap-2">
        <Input
          aria-label="Filter tasks by keyword"
          className="min-w-0 flex-1"
          placeholder="Filter by keyword"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">View</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortDirection}
              onValueChange={(value) => setSortDirection(value as 'asc' | 'desc')}
            >
              <DropdownMenuRadioItem value="asc">
                Due date: earliest first
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                Due date: latest first
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="kanban-scroll flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-2">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            accentClass={col.accentClass}
            tasks={tasksByStatus[col.status]}
            onDropTask={handleDropTask}
          />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  return (
    <DndProvider backend={HTML5Backend}>
      <KanbanBoardContent />
    </DndProvider>
  );
}
