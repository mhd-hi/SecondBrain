import type { TEvent } from '@/calendar/types';
import type { Task } from '@/types/task';
import { getDaypartTimes } from '@/lib/utils/course/daypart';
import { getStatusBgClass } from '@/lib/utils/task/task-util';

/**
 * Converts a Task to an TEvent for calendar display
 */
export function taskToEvent(task: Task): TEvent {
  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0); // Reset time to start of day
  const { startDate, endDate } = getDaypartTimes(dueDate, task.course.daypart);

  return {
    id: task.id,
    startDate,
    endDate,
    title: task.title,
    description: task.notes,
    color: task.course.color,
    secondaryColor: getStatusBgClass(task.status),
    type: 'task',
    courseCode: task.course.code,
    courseId: task.courseId,
  };
}
