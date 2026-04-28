'use client';
import type { TaskType } from '@/types/task';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { DueDateDisplay } from '@/components/shared/atoms/due-date-display';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCourses } from '@/hooks/course/use-course-store';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';
import { useTaskStore } from '@/lib/stores/task-store';
import {
  buildDefaultTaskDraft,
  getTaskEstimatedEffortInputValue,
  isValidTaskEstimatedEffort,
  MIN_TASK_ESTIMATED_EFFORT,
  parseTaskEstimatedEffortInput,
} from '@/lib/utils/task/task-draft';
import { TASK_TYPES } from '@/types/task';
import { TEST_IDS } from '@/lib/testing/selectors';

const ADD_TASK_DESCRIPTION_ID = 'add-task-description';

type AddTaskDialogProps = {
  courseId?: string;
  dueDate?: Date;
  trigger?: React.ReactNode | false;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const AddTaskDialog = ({
  courseId,
  dueDate,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: AddTaskDialogProps) => {
  // Get global selectedDate from store if dueDate prop not provided
  const { courses } = useCourses();
  const globalSelectedDate = useCalendarViewStore(state => state.selectedDate);
  const effectiveDueDate = dueDate || globalSelectedDate;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
  const { createTask, isLoading } = useTaskStore();
  const createTaskDraft = React.useCallback(
    () => buildDefaultTaskDraft({ dueDate: effectiveDueDate }),
    [effectiveDueDate],
  );
  const [newTask, setNewTask] = React.useState(createTaskDraft);
  const [estimatedEffortInput, setEstimatedEffortInput] = React.useState(() => getTaskEstimatedEffortInputValue(createTaskDraft().estimatedEffort));
  const [internalSelectedCourseId, setInternalSelectedCourseId] = React.useState<string | null>(null);
  const [createMore, setCreateMore] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const activeCourseId = courseId ?? internalSelectedCourseId;
  const activeCourse = React.useMemo(
    () => courses.find(course => course.id === activeCourseId),
    [activeCourseId, courses],
  );

  // Sync newTask.dueDate with effectiveDueDate when dialog opens
  React.useEffect(() => {
    if (isOpen && effectiveDueDate) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setNewTask(prev => ({
        ...prev,
        dueDate: effectiveDueDate,
      }));
    }
  }, [isOpen, effectiveDueDate]);
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTaskEstimatedEffort(newTask.estimatedEffort)) {
      toast.error('Estimated effort must be at least 0.5 hours.');
      return;
    }
    if (!activeCourseId) {
      toast.error('Please select a course.');
      return;
    }
    const success = await createTask(activeCourseId, newTask);
    if (success) {
      toast.success('Task added successfully');

      // Reset form
      const resetTask = createTaskDraft();
      setNewTask(resetTask);
      setEstimatedEffortInput(getTaskEstimatedEffortInputValue(resetTask.estimatedEffort));

      if (!createMore) {
        // Close dialog after successful addition
        setIsOpen(false);
      } else {
        // Focus the title input for quick next task entry
        setTimeout(() => {
          titleInputRef.current?.focus();
        }, 100);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger !== false && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent aria-describedby={ADD_TASK_DESCRIPTION_ID} data-testid={TEST_IDS.addTaskDialog.dialog}>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription id={ADD_TASK_DESCRIPTION_ID}>
            {activeCourse ? `Add a new task for ${activeCourse.code}` : 'Add a new task'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddTask}>
          <div className="grid gap-4 py-4">
            {!courseId && courses.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="course">Course</Label>
                <select
                  id="course"
                  data-testid={TEST_IDS.addTaskDialog.courseSelect}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={internalSelectedCourseId ?? ''}
                  onChange={e => setInternalSelectedCourseId(e.target.value)}
                  required={!courseId}
                >
                  <option value="" disabled>Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                ref={titleInputRef}
                id="title"
                data-testid={TEST_IDS.addTaskDialog.titleInput}
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                data-testid={TEST_IDS.addTaskDialog.notesInput}
                value={newTask.notes}
                onChange={e => setNewTask({ ...newTask, notes: e.target.value })}
                placeholder="(Optional) Add additional notes about the task"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                data-testid={TEST_IDS.addTaskDialog.typeSelect}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newTask.type}
                onChange={e => setNewTask({ ...newTask, type: e.target.value as TaskType })}
                required
              >
                <option value={TASK_TYPES.THEORIE}>Théorie</option>
                <option value={TASK_TYPES.PRATIQUE}>Pratique</option>
                <option value={TASK_TYPES.EXAM}>Examen</option>
                <option value={TASK_TYPES.HOMEWORK}>Devoir</option>
                <option value={TASK_TYPES.LAB}>Laboratoire</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <DueDateDisplay
                date={newTask.dueDate}
                onChange={date => date && setNewTask({ ...newTask, dueDate: date })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                triggerTestId={TEST_IDS.addTaskDialog.dueDateTrigger}
                calendarTestId={TEST_IDS.addTaskDialog.dueDateCalendar}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estimatedEffort">Estimated Effort (hours)</Label>
              <Input
                id="estimatedEffort"
                type="number"
                step="0.5"
                data-testid={TEST_IDS.addTaskDialog.estimatedEffortInput}
                value={estimatedEffortInput}
                onChange={(e) => {
                  const { value } = e.target;
                  setEstimatedEffortInput(value);

                  const parsedEffort = parseTaskEstimatedEffortInput(value);
                  if (parsedEffort !== null) {
                    setNewTask({ ...newTask, estimatedEffort: parsedEffort });
                  }
                }}
                min={MIN_TASK_ESTIMATED_EFFORT}
                required
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-more"
                className="size-4.5"
                data-testid={TEST_IDS.addTaskDialog.createMoreCheckbox}
                checked={createMore}
                onCheckedChange={checked => setCreateMore(checked === true)}
              />
              <label
                htmlFor="create-more"
                className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
              >
                Create more
              </label>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1 sm:flex-initial"
                data-testid={TEST_IDS.addTaskDialog.cancelButton}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-initial" data-testid={TEST_IDS.addTaskDialog.submitButton}>
                {isLoading ? 'Adding...' : 'Add Task'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
