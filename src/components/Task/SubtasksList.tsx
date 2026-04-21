'use client';
import type { Subtask } from '@/types/subtask';
import { CheckCircle2, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import * as React from 'react';
import { ActionsDropdown } from '@/components/shared/atoms/actions-dropdown';
import { Badge } from '@/components/ui/badge';
import { useSubtaskActions } from '@/hooks/task/use-subtask-actions';
import { cn } from '@/lib/utils';
import { StatusTask } from '@/types/status-task';
import { EditableField } from '../shared/EditableField';

type SubtasksListProps = {
  subtasks: Subtask[];
  onEditSubtask?: (subtaskId: string, changes: Partial<Subtask>) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
  onTaskAdded?: () => void;
  taskId?: string;
  courseId?: string | null;
  courseIdDueDate?: Date | string | undefined;
  readonly?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
};

const SubtasksList = ({
  subtasks,
  onEditSubtask,
  onDeleteSubtask,
  onTaskAdded,
  taskId,
  courseId,
  courseIdDueDate,
  readonly = false,
  collapsible = false,
  defaultExpanded = true,
  isExpanded: controlledIsExpanded,
  onToggleExpanded,
}: SubtasksListProps) => {
  const [internalIsExpanded, setInternalIsExpanded] = React.useState(defaultExpanded);
  const [hoveredSubtaskId, setHoveredSubtaskId] = React.useState<string | null>(null);
  const isExpanded = controlledIsExpanded ?? internalIsExpanded;
  const {
    convertSubtaskToTask,
    deleteSubtask: deleteSubtaskAction,
    saveSubtaskNotes,
    saveSubtaskTitle,
  } = useSubtaskActions({
    courseId,
    courseIdDueDate,
    onDeleteSubtask,
    onEditSubtask,
    onTaskAdded,
    taskId,
  });

  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    if (collapsible) {
      if (onToggleExpanded) {
        onToggleExpanded();
      } else {
        setInternalIsExpanded(!internalIsExpanded);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <div id="subtasks-list" className={cn(isExpanded && 'mt-1')}>
      {collapsible && (
        <div
          className={cn(
            'flex items-center gap-2',
            !isExpanded && 'mt-4',
            'cursor-pointer hover:text-foreground',
          )}
          onClick={toggleExpanded}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={`Toggle subtasks section (${subtasks.length} subtasks)`}
        >
          {isExpanded
            ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )
            : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          <h5 className="text-sm font-medium text-muted-foreground">
            Subtasks (
            {subtasks.length}
            )
          </h5>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-2 pl-3 border-l border-muted">
          {subtasks.map(subtask => (
            <div
              key={subtask.id}
              onMouseEnter={() => setHoveredSubtaskId(subtask.id)}
              onMouseLeave={() => setHoveredSubtaskId(prev => (prev === subtask.id ? null : prev))}
              className={cn(
                'relative overflow-visible flex items-start justify-between gap-4 p-3 rounded-lg border border-muted',
                'transition-colors',
                subtask.status === StatusTask.COMPLETED
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                  : 'bg-muted/30',
              )}
            >
              <div className="grow">
                <div className="flex items-center gap-2">
                  {subtask.status === StatusTask.COMPLETED
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <EditableField
                    value={subtask.title}
                    onSave={newTitle => saveSubtaskTitle(subtask.id, newTitle)}
                    inputType="input"
                    className={cn('text-sm font-medium', subtask.status === StatusTask.COMPLETED && 'text-muted-foreground')}
                    placeholder="Subtask title"
                  />
                  {subtask.estimatedEffort && (
                    <Badge variant="outline" className="text-xs">
                      {`${subtask.estimatedEffort}h`}
                    </Badge>
                  )}
                </div>
                {typeof subtask.notes === 'string' && (
                  <EditableField
                    value={subtask.notes}
                    onSave={newNotes => saveSubtaskNotes(subtask.id, newNotes)}
                    inputType="textarea"
                    className="text-xs text-muted-foreground ml-6"
                    placeholder="Subtask notes"
                  />
                )}
              </div>
              {
                readonly
                  ? (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {subtask.status}
                    </Badge>
                  )
                  : (
                    // Hover-only actions dropdown
                    <ActionsDropdown
                      actions={[
                        {
                          label: 'Convert to task',
                          onClick: () => convertSubtaskToTask(subtask),
                        },
                        {
                          label: 'Delete subtask',
                          destructive: true,
                          onClick: () => deleteSubtaskAction(subtask.id),
                        },
                      ]}
                      triggerClassName={cn(
                        'absolute -top-[10px] -right-[10px] z-50 transition-opacity',
                        hoveredSubtaskId === subtask.id ? 'opacity-100' : 'opacity-0 pointer-events-none',
                      )}
                    />
                  )
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { SubtasksList };
