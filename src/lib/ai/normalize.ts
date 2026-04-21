import type { AITask } from '@/types/api/ai';
import type { Subtask } from '@/types/subtask';
import type { Task, TaskType } from '@/types/task';
import { StatusTask } from '@/types/status-task';

/**
 * Normalizes AI-generated tasks into the application's task format
 * Note: Due dates are intentionally NOT set here - they are calculated later
 * in use-add-course.ts using week numbers and firstDayOfClass
 */
export function normalizeTasks(
  raw: AITask[],
): Array<Omit<Task, 'id' | 'courseId' | 'course'>> {
  return raw.map((item) => {
    const type = (item.type ?? 'theorie') as TaskType;
    const title = String(item.title ?? '').trim();
    const notes = item.notes ? String(item.notes) : undefined;
    const estimatedEffort =
      typeof item.estimatedEffort === 'number'
        ? item.estimatedEffort
        : Number(item.estimatedEffort) || 0;
    const subtasks: Subtask[] | undefined = Array.isArray(item.subtasks)
      ? item.subtasks.map(st => ({
        id: crypto.randomUUID(),
        title: String(st.title ?? ''),
        notes: st.notes ? String(st.notes) : undefined,
      }))
      : undefined;

    const task: Omit<Task, 'id' | 'courseId' | 'course'> = {
      title,
      notes,
      type,
      status: StatusTask.TODO,
      estimatedEffort,
      actualEffort: 0,
      subtasks,
      createdAt: new Date(),
      updatedAt: new Date(),
      // dueDate will be set by the caller using AI-provided week numbers
      dueDate: new Date(),
    };

    return task;
  });
}
