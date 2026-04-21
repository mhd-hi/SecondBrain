import type { StatusTask } from '@/types/status-task';
import type { Subtask } from '@/types/subtask';
import type { TaskType } from '@/types/task';
import { StatusTask as TaskStatus } from '@/types/status-task';
import { TASK_TYPES } from '@/types/task';

export type TaskDraft = {
  title: string;
  notes: string;
  estimatedEffort: number;
  dueDate: Date;
  type: TaskType;
  status: StatusTask;
};

const DEFAULT_TASK_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_TASK_ESTIMATED_EFFORT = 3;

function parseTaskDueDate(dueDate?: Date | string | null) {
  if (dueDate instanceof Date) {
    return Number.isNaN(dueDate.getTime()) ? undefined : new Date(dueDate);
  }

  if (typeof dueDate === 'string') {
    const parsedDate = new Date(dueDate);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

export function getDefaultTaskDueDate(referenceDate = new Date()) {
  return new Date(referenceDate.getTime() + DEFAULT_TASK_OFFSET_MS);
}

export function buildDefaultTaskDraft({
  dueDate,
  estimatedEffort = DEFAULT_TASK_ESTIMATED_EFFORT,
  type = TASK_TYPES.THEORIE,
  status = TaskStatus.TODO,
}: {
  dueDate?: Date | string | null;
  estimatedEffort?: number;
  type?: TaskType;
  status?: StatusTask;
} = {}): TaskDraft {
  return {
    title: '',
    notes: '',
    estimatedEffort,
    dueDate: parseTaskDueDate(dueDate) ?? getDefaultTaskDueDate(),
    type,
    status,
  };
}

export function buildTaskFromSubtask(
  subtask: Pick<Subtask, 'title' | 'notes'>,
  {
    dueDate,
    type = TASK_TYPES.THEORIE,
    status = TaskStatus.TODO,
  }: {
    dueDate?: Date | string | null;
    type?: TaskType;
    status?: StatusTask;
  } = {},
): TaskDraft {
  return {
    ...buildDefaultTaskDraft({ dueDate, type, status, estimatedEffort: DEFAULT_TASK_ESTIMATED_EFFORT }),
    title: subtask.title,
    notes: subtask.notes ?? '',
  };
}
