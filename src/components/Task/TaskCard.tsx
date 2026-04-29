'use client';

import type { Task } from '@/types/task';
import { BarChart3, Clock, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionsDropdown } from '@/components/shared/atoms/actions-dropdown';
import { DueDateDisplay } from '@/components/shared/atoms/due-date-display';
import { AddSubtaskDialog } from '@/components/shared/dialogs/AddSubtaskDialog';
import { StatusTaskChanger } from '@/components/Task/StatusTaskChanger';
import { SubtasksList } from '@/components/Task/SubtasksList';
import { SubtasksPill } from '@/components/Task/SubtasksPill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTaskCard } from '@/hooks/task/use-task-card';
import { getCourseTaskPath, getPomodoroPath } from '@/lib/page-routes';
import { cn } from '@/lib/utils/colors-util';
import { formatEffortTime } from '@/lib/utils/task/task-util';
import { StatusTask } from '@/types/status-task';
import { TASK_TYPE_OPTIONS } from '@/types/task';
import { TEST_IDS } from '@/lib/testing/selectors';
import { CourseCodeBadge } from '../shared/atoms/CourseCodeBadge';
import { EditableField } from '../shared/EditableField';

type TaskCardProps = {
  task: Task;
  onDeleteTask: (taskId: string) => void;
  onUpdateStatusTask: (taskId: string, newStatus: StatusTask) => void;
  className?: string;
  onTaskAdded?: () => void;
  showCourseBadge?: boolean;
  isSubtasksExpanded?: boolean;
  onToggleSubtasksExpanded?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    destructive?: boolean;
  }>;
};

export function TaskCard({
  task,
  onDeleteTask,
  onUpdateStatusTask,
  className,
  showCourseBadge = false,
  isSubtasksExpanded: controlledSubtasksExpanded,
  onToggleSubtasksExpanded,
  actions,
  onTaskAdded,
}: TaskCardProps) {
  const router = useRouter();
  const [internalSubtasksExpanded, setInternalSubtasksExpanded] = useState(false);
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false);
  const isSubtasksExpanded = controlledSubtasksExpanded ?? internalSubtasksExpanded;
  const {
    editedEffort,
    effortInputContainerRef,
    handleEffortKeyDown,
    isEditingEffort,
    isTypeDropdownOpen,
    saveDescription,
    saveDueDate,
    saveEffort,
    saveTitle,
    saveType,
    setEditedEffort,
    setIsTypeDropdownOpen,
    startEffortEditing,
  } = useTaskCard(task);
  const isCompleted = task.status === StatusTask.COMPLETED;
  const subtasks = task.subtasks ?? [];

  const handleNavigateToTask = () => {
    if (task.course?.id) {
      router.push(getCourseTaskPath(task.course.id, task.id));
    }
  };

  const handleStartPomodoro = () => {
    router.push(getPomodoroPath());
  };

  const defaultActions = [
    {
      label: 'Add subtask',
      onClick: () => setIsAddSubtaskOpen(true),
    },
    {
      label: 'Delete task',
      onClick: () => onDeleteTask(task.id),
      destructive: true,
    },
  ];

  const cardActions = actions ?? defaultActions;

  return (
    <div
      className={cn(
        'relative group p-2 rounded-lg border bg-card text-card-foreground shadow-sm transition-colors',
        isCompleted && 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
        className,
      )}
      data-task-id={task.id}
      data-testid={TEST_IDS.task.card}
    >
      <ActionsDropdown
        actions={cardActions}
        triggerClassName="absolute -top-[10px] -right-[10px] z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        triggerTestId={TEST_IDS.task.actionsTrigger}
      />
      <AddSubtaskDialog
        taskId={task.id}
        open={isAddSubtaskOpen}
        onOpenChange={setIsAddSubtaskOpen}
      />
      {showCourseBadge && task.course && (
        <div className="ml-1 mb-1">
          <CourseCodeBadge
            course={task.course}
            onClick={handleNavigateToTask}
          />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0 w-full md:w-auto">
          <EditableField
            value={task.title}
            onSave={saveTitle}
            inputType="input"
            className={cn('font-medium', isCompleted && 'text-muted-foreground')}
            placeholder="Task title"
          />

          <EditableField
            value={task.notes ?? ''}
            onSave={saveDescription}
            inputType="textarea"
            className={cn('text-sm text-muted-foreground', isCompleted && 'opacity-70')}
            placeholder="Task description"
          />
          <div className="flex items-center gap-2 mt-2">
            <SubtasksPill
              subtasks={subtasks}
              isExpanded={isSubtasksExpanded}
              onToggle={() => {
                if (onToggleSubtasksExpanded) {
                  onToggleSubtasksExpanded();
                } else {
                  setInternalSubtasksExpanded(!internalSubtasksExpanded);
                }
              }}
            />

            <DropdownMenu open={isTypeDropdownOpen} onOpenChange={setIsTypeDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant="muted"
                  className="cursor-pointer select-none"
                  title="Click to change task type"
                >
                  <span className="text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
                    {TASK_TYPE_OPTIONS.find(opt => opt.value === task.type)?.label ?? task.type}
                  </span>
                </Badge>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="min-w-32 p-1">
                {TASK_TYPE_OPTIONS.map(opt => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={(e) => {
                      e.preventDefault();
                      saveType(opt.value as Task['type']);
                    }}
                    className={cn(
                      'text-xs cursor-pointer',
                      task.type === opt.value && 'font-semibold text-primary',
                    )}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {((task.estimatedEffort >= 0) || editedEffort) && (
              <div>
                {isEditingEffort && (
                  <div ref={effortInputContainerRef} className="w-16 max-w-18">
                    <Input
                      type="number"
                      value={editedEffort ?? ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setEditedEffort(e.target.value === '' ? undefined : Number(e.target.value));
                      }}
                      onBlur={saveEffort}
                      onKeyDown={handleEffortKeyDown}
                      className="h-6 px-2 py-0.5 text-xs"
                      min={0}
                    />
                  </div>
                )}

                {!isEditingEffort && (
                  <Badge
                    variant="muted"
                    onClick={startEffortEditing}
                    title="Click to edit estimated effort (hours)"
                  >
                    <span className="text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatEffortTime(task.estimatedEffort)}
                    </span>
                  </Badge>
                )}
              </div>
            )}

            {task.estimatedEffort > 0 && task.actualEffort > 0 && (
              <Badge variant="muted">
                <span className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                  <BarChart3 className="h-3 w-3 shrink-0" />
                  {Math.round((task.actualEffort / task.estimatedEffort) * 100)}
                  % complete
                </span>
              </Badge>
            )}

            <Badge variant="muted" className="overflow-visible">
              <span aria-label="Edit due date" className="block w-full min-w-0">
                <DueDateDisplay
                  date={task.dueDate ?? null}
                  onChange={d => saveDueDate(d ?? null)}
                  triggerTestId={TEST_IDS.task.dueDateTrigger}
                  calendarTestId={TEST_IDS.task.dueDateCalendar}
                />
              </span>
            </Badge>
          </div>
        </div>

        <div
          className={cn(
            'flex flex-row flex-wrap gap-2 w-full items-start',
            'md:flex-col md:items-end md:w-auto md:mr-2',
          )}
        >
          <div className="flex flex-row flex-wrap gap-2 lg:flex-col lg:w-auto">
            <div className="shrink min-w-0 ml-auto">
              <StatusTaskChanger
                currentStatus={task.status}
                onStatusChange={newStatus => onUpdateStatusTask(task.id, newStatus)}
                triggerTestId={TEST_IDS.task.statusTrigger}
                cycleButtonTestId={TEST_IDS.task.nextStatusButton}
              />
            </div>
            {task.status === StatusTask.IN_PROGRESS && (
              <Button
                onClick={handleStartPomodoro}
                size="sm"
                className="pomodoro-button h-8 px-3 shrink min-w-0 ml-auto"
              >
                <Play className="h-4 w-4" />
                Pomodoro
              </Button>
            )}
          </div>
        </div>
      </div>
      <SubtasksList
        taskId={task.id}
        subtasks={subtasks}
        courseId={task.courseId}
        courseIdDueDate={task.dueDate}
        onTaskAdded={onTaskAdded}
        collapsible={false}
        defaultExpanded={false}
        isExpanded={isSubtasksExpanded}
      />
    </div>
  );
}
