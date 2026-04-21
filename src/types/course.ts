import type { TCourseColor } from './colors';
import type { Task } from './task';

export type Daypart = 'EVEN' | 'AM' | 'PM';

export type CourseTaskPreview = {
  id: string;
  title: string;
  dueDate: Date | string;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  daypart: Daypart;
  color: TCourseColor;
  createdAt?: Date;
  updatedAt?: Date;
  totalTasks?: number;
  completedTasks?: number;
  inProgressTasks?: number;
  todoTasks?: number;
  overdueCount?: number;
  dueSoonCount?: number;
  nextTask?: CourseTaskPreview | null;
  upcomingTask?: CourseTaskPreview | null;
  tasks?: Task[];
};
