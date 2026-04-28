import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { courses, subtasks, tasks } from '@/server/db/schema';
import { StatusTask } from '@/types/status-task';

export async function findUserCoursesWithTasks(userId: string) {
  return db.query.courses.findMany({
    where: eq(courses.userId, userId),
    columns: {
      id: true,
      name: true,
      code: true,
      term: true,
      color: true,
      daypart: true,
    },
    with: {
      tasks: {
        columns: {
          id: true,
          courseId: true,
          title: true,
          notes: true,
          type: true,
          status: true,
          estimatedEffort: true,
          actualEffort: true,
          dueDate: true,
        },
      },
    },
  });
}

export async function findUserCourseMetadata(userId: string) {
  return db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      color: courses.color,
      daypart: courses.daypart,
    })
    .from(courses)
    .where(eq(courses.userId, userId))
    .orderBy(asc(courses.code));
}

export async function findUserCourseSummaryMetrics(
  userId: string,
  today: Date,
  dueSoonEnd: Date,
) {
  return db
    .select({
      courseId: tasks.courseId,
      totalTasks: sql<number>`cast(count(*) as int)`,
      completedTasks: sql<number>`cast(coalesce(sum(case when ${tasks.status} = ${StatusTask.COMPLETED} then 1 else 0 end), 0) as int)`,
      inProgressTasks: sql<number>`cast(coalesce(sum(case when ${tasks.status} = ${StatusTask.IN_PROGRESS} then 1 else 0 end), 0) as int)`,
      todoTasks: sql<number>`cast(coalesce(sum(case when ${tasks.status} = ${StatusTask.TODO} then 1 else 0 end), 0) as int)`,
      overdueCount: sql<number>`cast(coalesce(sum(case when ${tasks.status} != ${StatusTask.COMPLETED} and ${tasks.dueDate} < ${sql.param(today, tasks.dueDate)} then 1 else 0 end), 0) as int)`,
      dueSoonCount: sql<number>`cast(coalesce(sum(case when ${tasks.status} != ${StatusTask.COMPLETED} and ${tasks.dueDate} >= ${sql.param(today, tasks.dueDate)} and ${tasks.dueDate} <= ${sql.param(dueSoonEnd, tasks.dueDate)} then 1 else 0 end), 0) as int)`,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.courseId);
}

export async function findUserCourseSummaryCandidateTasks(userId: string) {
  return db
    .select({
      courseId: tasks.courseId,
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      type: tasks.type,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), sql`${tasks.status} <> ${StatusTask.COMPLETED}`))
    .orderBy(asc(tasks.courseId), asc(tasks.dueDate));
}

export async function findCourseByUserCodeTerm(userId: string, code: string, term: string) {
  return db.query.courses.findFirst({
    where: and(eq(courses.userId, userId), eq(courses.code, code), eq(courses.term, term)),
    columns: { id: true, code: true, name: true },
  });
}

export async function courseExists(userId: string, code: string, term: string): Promise<{ exists: boolean }> {
  const found = await findCourseByUserCodeTerm(userId, code, term);
  return { exists: !!found };
}

export async function findCourseOwnershipByIdAndUser(courseId: string, userId: string) {
  return db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.userId, userId)),
    columns: { id: true },
  });
}

export async function findCourseByIdAndUser(courseId: string, userId: string) {
  return db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.userId, userId)),
    columns: {
      id: true,
      code: true,
      name: true,
      term: true,
      color: true,
      daypart: true,
    },
  });
}

export async function findTasksWithSubtasks(courseId: string, userId: string) {
  const taskRows = await db
    .select({
      id: tasks.id,
      courseId: tasks.courseId,
      title: tasks.title,
      notes: tasks.notes,
      type: tasks.type,
      status: tasks.status,
      estimatedEffort: tasks.estimatedEffort,
      actualEffort: tasks.actualEffort,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(and(eq(tasks.courseId, courseId), eq(tasks.userId, userId)))
    .orderBy(tasks.dueDate);

  if (taskRows.length === 0) {
    return [];
  }

  const taskIds = taskRows.map(t => t.id);
  const subtaskRows = await db
    .select({
      id: subtasks.id,
      taskId: subtasks.taskId,
      title: subtasks.title,
      notes: subtasks.notes,
    })
    .from(subtasks)
    .where(inArray(subtasks.taskId, taskIds));

  const subtasksByTask = new Map<string, typeof subtaskRows>();
  for (const sub of subtaskRows) {
    const list = subtasksByTask.get(sub.taskId) ?? [];
    list.push(sub);
    subtasksByTask.set(sub.taskId, list);
  }

  return taskRows.map(task => ({
    ...task,
    subtasks: subtasksByTask.get(task.id) ?? [],
  }));
}

export default {
  findUserCourseMetadata,
  findUserCourseSummaryCandidateTasks,
  findUserCourseSummaryMetrics,
  findUserCoursesWithTasks,
  findCourseByUserCodeTerm,
  findCourseOwnershipByIdAndUser,
  findCourseByIdAndUser,
  findTasksWithSubtasks,
};
