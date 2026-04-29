'use client';

import type { Task } from '@/types/task';
import type { FilterType, GroupConfig, GroupedTasks, TodaysFocusGroup } from '@/types/todays-focus';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { TaskCard } from '@/components/Task/TaskCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchFocusTasks, updateTaskStatus } from '@/hooks/task/use-task';
import { getCourseTaskPath } from '@/lib/page-routes';
import { useTaskStore } from '@/lib/stores/task-store';
import { CommonErrorMessages } from '@/lib/utils/errors/error';
import { StatusTask } from '@/types/status-task';

const GroupSection = ({
  title,
  tasks,
  sectionKey,
  expandedSections,
  toggleSectionExpanded,
  expandedSubtasks,
  toggleSubtasksExpanded,
  handleDeleteTask,
  handleStatusChange,
  onTaskAdded,
  removingTaskIds,
}: {
  title: string;
  tasks: Task[];
  sectionKey: TodaysFocusGroup;
  expandedSections: Set<TodaysFocusGroup>;
  toggleSectionExpanded: (sectionKey: TodaysFocusGroup) => void;
  expandedSubtasks: Set<string>;
  toggleSubtasksExpanded: (taskId: string) => void;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleStatusChange: (taskId: string, newStatus: StatusTask) => Promise<void>;
  onTaskAdded?: () => void;
  removingTaskIds: Set<string>;
}) => {
  if (tasks.length === 0) {
    return null;
  }

  const isExpanded = expandedSections.has(sectionKey);
  const maxDisplayTasks = 5;
  const shouldLimit = tasks.length > maxDisplayTasks;
  const displayTasks = shouldLimit && !isExpanded ? tasks.slice(0, maxDisplayTasks) : tasks;
  const hiddenCount = shouldLimit && !isExpanded ? tasks.length - maxDisplayTasks : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-base font-semibold text-foreground">{title}</h4>
        <Badge variant="secondary" className="text-xs">
          {displayTasks.length}
        </Badge>
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-foreground">
            (+
            {hiddenCount}
            {' '}
            more)
          </span>
        )}
      </div>

      <div className="space-y-2">
        {displayTasks.map(task => (
          <div
            key={task.id}
            className={`transition-all duration-300 ease-in-out ${
              removingTaskIds.has(task.id)
                ? 'opacity-0 scale-95 transform -translate-y-2'
                : 'opacity-100 scale-100 transform translate-y-0'
            }`}
          >
            <TaskCard
              task={task}
              onDeleteTask={handleDeleteTask}
              onUpdateStatusTask={handleStatusChange}
              showCourseBadge={true}
              isSubtasksExpanded={expandedSubtasks.has(task.id)}
              onToggleSubtasksExpanded={() => toggleSubtasksExpanded(task.id)}
              onTaskAdded={onTaskAdded}
              actions={task.course?.id
                ? [
                  {
                    label: `Go to ${task.course.code}`,
                    onClick: () => {
                      if (task.course?.id) {
                        window.location.href = getCourseTaskPath(task.course.id, task.id);
                      }
                    },
                    destructive: false,
                  },
                  {
                    label: 'Delete',
                    onClick: () => void handleDeleteTask(task.id),
                    destructive: true,
                  },
                ]
                : [
                  {
                    label: 'Delete',
                    onClick: () => void handleDeleteTask(task.id),
                    destructive: true,
                  },
                ]}
            />
          </div>
        ))}

        {shouldLimit && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSectionExpanded(sectionKey)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? 'See less' : `See ${hiddenCount} more tasks`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export const TodaysFocusTile = () => {
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('week');
  const [expandedSections, setExpandedSections] = useState<Set<TodaysFocusGroup>>(() => new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(() => new Set());
  const [removingTaskIds, setRemovingTaskIds] = useState<Set<string>>(() => new Set());
  const tasks = useTaskStore(
    useShallow(state => taskIds.flatMap((taskId) => {
      const task = state.tasks.get(taskId);
      return task ? [task] : [];
    })),
  );

  const removeTask = useTaskStore(state => state.removeTask);
  const upsertTasks = useTaskStore(state => state.upsertTasks);

  const fetchFocusTasksData = useCallback(async () => {
    setIsLoading(true);
    try {
      const focusTasks = await fetchFocusTasks(filter);
      upsertTasks(focusTasks);
      setTaskIds(focusTasks.map(task => task.id));
      setRemovingTaskIds(new Set());
    } catch (error) {
      console.error('Failed to load focus tasks:', error);
      toast.error('Failed to load focus tasks');
    } finally {
      setIsLoading(false);
    }
  }, [filter, upsertTasks]);

  useEffect(() => {
    void fetchFocusTasksData();
  }, [fetchFocusTasksData]);

  const shouldRemoveTask = (newStatus: StatusTask): boolean => {
    return newStatus === StatusTask.COMPLETED;
  };

  const handleStatusChange = async (taskId: string, newStatus: StatusTask) => {
    if (shouldRemoveTask(newStatus)) {
      setRemovingTaskIds(prev => new Set(prev).add(taskId));
    }

    try {
      await updateTaskStatus(taskId, newStatus);

      if (shouldRemoveTask(newStatus)) {
        setTimeout(() => {
          setTaskIds(prevTaskIds => prevTaskIds.filter(id => id !== taskId));
          setRemovingTaskIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }, 300);
      }
    } catch (error) {
      console.error(CommonErrorMessages.TASK_STATUS_UPDATE_FAILED, error);

      if (shouldRemoveTask(newStatus)) {
        setRemovingTaskIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      setRemovingTaskIds(prev => new Set(prev).add(taskId));

      const removed = await removeTask(taskId);
      if (!removed) {
        throw new Error('Failed to delete task');
      }

      setTimeout(() => {
        setTaskIds(prevTaskIds => prevTaskIds.filter(id => id !== taskId));
        setRemovingTaskIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }, 300);
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');

      setRemovingTaskIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const toggleSectionExpanded = (sectionKey: TodaysFocusGroup) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  const toggleSubtasksExpanded = (taskId: string) => {
    setExpandedSubtasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const groupTasksByDate = (tasks: Task[]): GroupedTasks => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    return tasks.reduce<GroupedTasks>((groups, task) => {
      const taskDate = new Date(task.dueDate);
      taskDate.setHours(0, 0, 0, 0);

      if (taskDate < today && task.status !== StatusTask.COMPLETED) {
        groups.overdue.push(task);
      } else if (taskDate.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (taskDate.getTime() === tomorrow.getTime()) {
        groups.tomorrow.push(task);
      } else if (taskDate < endOfWeek) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }

      return groups;
    }, {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    });
  };

  const groupedTasks = groupTasksByDate(tasks);

  const GROUP_CONFIGS: Record<TodaysFocusGroup, GroupConfig> = {
    overdue: { title: 'Overdue', tasks: groupedTasks.overdue },
    today: { title: 'Due Today', tasks: groupedTasks.today },
    tomorrow: { title: 'Due Tomorrow', tasks: groupedTasks.tomorrow },
    thisWeek: { title: 'Due This Week', tasks: groupedTasks.thisWeek },
    later: { title: 'Due Later', tasks: groupedTasks.later },
  };

  const visibleGroups: TodaysFocusGroup[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'later'];

  return (
    <div className="border rounded-lg bg-muted/30 min-h-80 flex flex-col">
      <div className="p-6 pb-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Today&apos;s Focus</h2>
          <div className="flex items-center gap-2">
            {[
              {
                key: 'week',
                label: 'This Week',
              },
              {
                key: 'month',
                label: 'This Month',
              },
              {
                key: 'quarter',
                label: 'This Quarter',
              },
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(key as FilterType)}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading
          ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={`loading-skeleton-${i}`} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          )
          : tasks.length === 0
            ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No tasks require your focus right now!</p>
                <p className="text-sm mt-1">
                {'🌤️ '}
                {filter === 'week' ? 'This week' : filter === 'month' ? 'This month' : 'Next quarter'}
                  {' '}
                  is looking clear.
                </p>
              </div>
            )
            : (
              <div className="space-y-6">
                {visibleGroups.map((groupKey) => {
                  const config = GROUP_CONFIGS[groupKey];
                  return (
                    <GroupSection
                      key={groupKey}
                      title={config.title}
                      tasks={config.tasks}
                      sectionKey={groupKey}
                      expandedSections={expandedSections}
                      toggleSectionExpanded={toggleSectionExpanded}
                      expandedSubtasks={expandedSubtasks}
                      toggleSubtasksExpanded={toggleSubtasksExpanded}
                      handleDeleteTask={handleDeleteTask}
                      handleStatusChange={handleStatusChange}
                      onTaskAdded={fetchFocusTasksData}
                      removingTaskIds={removingTaskIds}
                    />
                  );
                })}
              </div>
            )}
      </div>
    </div>
  );
};
