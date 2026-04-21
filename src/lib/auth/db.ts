import { and, eq } from 'drizzle-orm';
import { AuthorizationError } from '@/lib/auth/api';
import {
  findCourseByIdAndUser,
  findCourseOwnershipByIdAndUser,
  findTasksWithSubtasks,
  findUserCourseMetadata,
  findUserCourseSummaryCandidateTasks,
  findUserCourseSummaryMetrics,
  findUserCoursesWithTasks,
} from '@/lib/utils/course/queries';
import { db } from '@/server/db';
import { courses, subtasks, tasks } from '@/server/db/schema';
import { StatusTask } from '@/types/status-task';
import { TASK_TYPES } from '@/types/task';

/**
 * Get courses for authenticated user
 */
export async function getUserCourses(userId: string) {
  return findUserCoursesWithTasks(userId);
}

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

/**
 * Get single course for authenticated user with ownership verification
 */
export async function getUserCourse(courseId: string, userId: string) {
  const course = await findCourseByIdAndUser(courseId, userId);
  if (!course) {
    throw new AuthorizationError('Course not found');
  }
  return course;
}

export async function assertUserOwnsCourse(courseId: string, userId: string): Promise<void> {
  const ownedCourse = await findCourseOwnershipByIdAndUser(courseId, userId);
  if (!ownedCourse) {
    throw new AuthorizationError('Course not found');
  }
}

/**
 * Get tasks for a specific course with user verification
 * Optimized with single query using manual aggregation
 */
export async function getUserCourseTasks(courseId: string, userId: string) {
  return findTasksWithSubtasks(courseId, userId);
}

/**
 * Get single task with ownership verification
 */
export async function getUserTask(taskId: string, userId: string) {
  const task = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task.length) {
    throw new AuthorizationError('Task not found or access denied');
  }

  const t = task[0]!;
  // Attach subtasks
  const subs = await db.select().from(subtasks).where(eq(subtasks.taskId, t.id));
  return { ...t, subtasks: subs };
}

/**
 * Update task with ownership verification
 */
export async function updateUserTask(
  taskId: string,
  userId: string,
  updates: Partial<typeof tasks.$inferInsert>,
) {
  // If updates include subtasks, handle them separately
  type SubUpdate = Partial<typeof subtasks.$inferInsert>;
  type UpdateWithSubs = Partial<typeof tasks.$inferInsert> & { subtasks?: SubUpdate[] };
  const { subtasks: subUpdates, ...taskUpdates } = updates as UpdateWithSubs;

  const result = await db
    .update(tasks)
    .set({
      ...taskUpdates,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();

  if (!result.length) {
    throw new AuthorizationError('Task not found or access denied');
  }

  // Process subtasks updates: upsert by id, delete missing ones if provided as full set
  if (Array.isArray(subUpdates)) {
    // Fetch existing subtask ids for this task
    const existing = await db.select().from(subtasks).where(eq(subtasks.taskId, taskId));
    const existingIds = new Set(existing.map(e => e.id));

    // Upsert provided subtasks
    for (const s of subUpdates) {
      const subToUpsert: Partial<typeof subtasks.$inferInsert> = {
        title: s.title ?? '',
        notes: s.notes ?? null,
        // Narrow status/type into the subtasks insert types
        status: (s.status as unknown as typeof subtasks.$inferInsert['status']) ?? StatusTask.TODO,
        estimatedEffort: typeof s.estimatedEffort === 'number' ? s.estimatedEffort : 0,
        type: (s.type as unknown as typeof subtasks.$inferInsert['type']) ?? 'theorie',
      };

      if (!s.id) {
        // insert
        await db.insert(subtasks).values({
          ...(subToUpsert as typeof subtasks.$inferInsert),
          id: crypto.randomUUID(),
          taskId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as typeof subtasks.$inferInsert);
      } else {
        // update
        await db.update(subtasks).set({
          ...subToUpsert,
          updatedAt: new Date(),
        }).where(eq(subtasks.id, s.id));
        existingIds.delete(s.id);
      }
    }

    // Delete any existing subtasks not present in the provided list
    for (const idToDelete of existingIds) {
      await db.delete(subtasks).where(eq(subtasks.id, idToDelete));
    }
  }

  return result[0];
}

/**
 * Delete task with ownership verification
 */
export async function deleteUserTask(taskId: string, userId: string) {
  const result = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();

  if (!result.length) {
    throw new AuthorizationError('Task not found or access denied');
  }

  return result[0];
}

/**
 * Create task with automatic user assignment
 */
export async function createUserTask(
  userId: string,
  taskData: Omit<typeof tasks.$inferInsert, 'userId' | 'id' | 'createdAt' | 'updatedAt'>,
  options?: { skipCourseOwnershipCheck?: boolean },
) {
  if (!options?.skipCourseOwnershipCheck) {
    await assertUserOwnsCourse(taskData.courseId, userId);
  }

  type ProvidedSub = Partial<typeof subtasks.$inferInsert>;
  type CreateTaskWithSubs = Omit<typeof tasks.$inferInsert, 'userId' | 'id' | 'createdAt' | 'updatedAt'> & { subtasks?: ProvidedSub[] };
  const { subtasks: providedSubs, ...taskFields } = taskData as CreateTaskWithSubs;

  const result = await db
    .insert(tasks)
    .values({
      ...taskFields,
      userId,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const createdTask = result[0]!;

  // Insert provided subtasks
  if (Array.isArray(providedSubs) && providedSubs.length > 0) {
    for (const s of providedSubs) {
      const subToInsert: typeof subtasks.$inferInsert = {
        title: s.title ?? '',
        notes: s.notes ?? null,
        status: (s.status as unknown as typeof subtasks.$inferInsert['status']) ?? StatusTask.TODO,
        estimatedEffort: typeof s.estimatedEffort === 'number' ? s.estimatedEffort : 0,
        type: (s.type as unknown as typeof subtasks.$inferInsert['type']) ?? 'theorie',
        id: s.id ?? crypto.randomUUID(),
        taskId: createdTask.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as typeof subtasks.$inferInsert;
      await db.insert(subtasks).values(subToInsert);
    }
  }

  return createdTask;
}

/**
 * Delete course with ownership verification
 */
export async function deleteUserCourse(courseId: string, userId: string) {
  const result = await db
    .delete(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .returning();

  if (!result.length) {
    throw new AuthorizationError('Course not found or access denied');
  }

  return result[0];
}

/**
 * Create course with automatic user assignment
 */
export async function createUserCourse(
  userId: string,
  courseData: Omit<typeof courses.$inferInsert, 'userId' | 'id' | 'createdAt' | 'updatedAt'>,
) {
  const result = await db
    .insert(courses)
    .values({
      ...courseData,
      userId,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0];
}
