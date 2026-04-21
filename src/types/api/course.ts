import type { TCourseColor } from '@/types/colors';
import type { CourseTaskPreview, Daypart } from '@/types/course';
import type { StatusTask } from '@/types/status-task';
import type { TaskType } from '@/types/task';

export type CourseApiResponse = {
  id: string;
  code: string;
  name: string;
  color: TCourseColor;
  createdAt: string;
  updatedAt: string;
  daypart: Daypart;
  tasks: Array<{
    id: string;
    title: string;
    notes?: string;
    dueDate?: string;
    type: TaskType;
    status: StatusTask;
    estimatedEffort: number;
    actualEffort: number;
    courseId: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type CourseListItem = {
  id: string;
  code: string;
  name: string;
  color: TCourseColor;
  overdueCount: number;
};

export type CourseSummaryApiResponse = {
  id: string;
  code: string;
  name: string;
  color: TCourseColor;
  daypart: Daypart;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueCount: number;
  dueSoonCount: number;
  nextTask: CourseTaskPreview | null;
  upcomingTask: CourseTaskPreview | null;
};
