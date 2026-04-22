import {
  findUserCourseMetadata,
  findUserCourseSummaryCandidateTasks,
  findUserCourseSummaryMetrics,
} from '@/lib/utils/course/queries';
import { TASK_TYPES } from '@/types/task';

export async function getUserCourseSummaries(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 7);
  dueSoonEnd.setHours(23, 59, 59, 999);

  const [courseMetadata, courseMetrics, candidateTasks] = await Promise.all([
    findUserCourseMetadata(userId),
    findUserCourseSummaryMetrics(userId, today, dueSoonEnd),
    findUserCourseSummaryCandidateTasks(userId),
  ]);

  const metricsByCourseId = new Map(
    courseMetrics.map(metric => [metric.courseId, metric] as const),
  );

  const tasksByCourseId = new Map<string, typeof candidateTasks>();
  for (const task of candidateTasks) {
    const existing = tasksByCourseId.get(task.courseId) ?? [];
    existing.push(task);
    tasksByCourseId.set(task.courseId, existing);
  }

  return courseMetadata.map((course) => {
    const metrics = metricsByCourseId.get(course.id);
    const courseTasks = tasksByCourseId.get(course.id) ?? [];
    const nextTask = courseTasks[0]
      ? {
          id: courseTasks[0].id,
          title: courseTasks[0].title,
          dueDate: courseTasks[0].dueDate,
        }
      : null;
    const upcomingTaskCandidate = courseTasks.find(task =>
      task.type === TASK_TYPES.EXAM || task.type === TASK_TYPES.HOMEWORK,
    );

    return {
      ...course,
      totalTasks: metrics?.totalTasks ?? 0,
      completedTasks: metrics?.completedTasks ?? 0,
      inProgressTasks: metrics?.inProgressTasks ?? 0,
      todoTasks: metrics?.todoTasks ?? 0,
      overdueCount: metrics?.overdueCount ?? 0,
      dueSoonCount: metrics?.dueSoonCount ?? 0,
      nextTask,
      upcomingTask: upcomingTaskCandidate
        ? {
            id: upcomingTaskCandidate.id,
            title: upcomingTaskCandidate.title,
            dueDate: upcomingTaskCandidate.dueDate,
          }
        : null,
    };
  });
}
