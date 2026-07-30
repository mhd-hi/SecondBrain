import type { AITask } from '@/types/api/ai';
import { z } from 'zod';
import { MIN_TASK_ESTIMATED_EFFORT } from '@/lib/utils/task/task-draft';
import { TASK_TYPES } from '@/types/task';

const shortText = z.string().trim().min(1).max(300);
const notes = z.string().max(2_000).optional();
const subtaskSchema = z.strictObject({
  title: shortText,
  notes,
});
const taskSchema = z.strictObject({
  week: z.number().int().positive(),
  type: z.enum(TASK_TYPES),
  title: shortText,
  notes,
  estimatedEffort: z.number().finite().min(MIN_TASK_ESTIMATED_EFFORT),
  subtasks: z.array(subtaskSchema).max(25).optional(),
});
const coursePlanTasksSchema = z.array(taskSchema).min(1).max(100);

export function parseCoursePlanTasks(aiText: string): AITask[] {
  return coursePlanTasksSchema.parse(JSON.parse(aiText)) as AITask[];
}
