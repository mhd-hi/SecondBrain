'use client';
import type { Course } from '@/types/course';
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
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { buildDefaultTaskDraft } from '@/lib/utils/task/task-draft';
import { TASK_TYPES } from '@/types/task';

type AddTaskDialogProps = {
  courseId?: string;
  courseCode?: string;
  dueDate?: Date;
  onTaskAdded: () => void;
  trigger?: React.ReactNode;
  courses: Course[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const AddTaskDialog = ({
  courseId,
  courseCode,
  dueDate,
  onTaskAdded,
  trigger,
  courses,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: AddTaskDialogProps) => {
  // Get global selectedDate from store if dueDate prop not provided
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
  const [selectedCourseId, setSelectedCourseId] = React.useState<string | null>(courseId ?? null);
  const [createMore, setCreateMore] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Sync selectedCourseId with courseId prop
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setSelectedCourseId(courseId ?? null);
  }, [courseId]);

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
    if (!courseId && !selectedCourseId) {
      toast.error('Please select a course.');
      return;
    }
    const success = await createTask(courseId ?? selectedCourseId!, newTask);
    if (success) {
      toast.success('Task added successfully');
      // Notify parent that a task was added (for any additional side effects)
      onTaskAdded();

      // Reset form
      setNewTask(createTaskDraft());

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
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            {courseCode ? `Add a new task for ${courseCode}` : 'Add a new task'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddTask}>
          <div className="grid gap-4 py-4">
            {!courseId && courses && courses.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="course">Course</Label>
                <select
                  id="course"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedCourseId ?? ''}
                  onChange={e => setSelectedCourseId(e.target.value)}
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
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newTask.notes}
                onChange={e => setNewTask({ ...newTask, notes: e.target.value })}
                placeholder="(Optional) Add additional notes about the task"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
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
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estimatedEffort">Estimated Effort (hours)</Label>
              <Input
                id="estimatedEffort"
                type="number"
                step="0.5"
                value={newTask.estimatedEffort}
                onChange={(e) => {
                  setNewTask({ ...newTask, estimatedEffort: Number.parseFloat(e.target.value) });
                }}
                min="0.5"
                required
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-more"
                className="size-4.5"
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
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-initial">
                {isLoading ? 'Adding...' : 'Add Task'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
