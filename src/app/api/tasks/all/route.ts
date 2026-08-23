import type { Subtask } from '@/types/subtask';
import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { parseStatusTask } from '@/lib/utils/task/task-util';
import { db } from '@/server/db';
import { courses, subtasks, tasks } from '@/server/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * @swagger
 * /api/tasks/all:
 *   get:
 *     summary: List all tasks across every course for the authenticated user
 *     tags: [Tasks]
 *     responses:
 *       200:
 *         description: All tasks with course and subtask info
 */
export const GET = withAuthSimple(async (request, user) => {
  const results = await db
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
      courseCode: courses.code,
      courseName: courses.name,
      courseColor: courses.color,
      courseDaypart: courses.daypart,
    })
    .from(tasks)
    .innerJoin(courses, eq(tasks.courseId, courses.id))
    .where(eq(tasks.userId, user.id));

  const taskIds = results.map((r) => r.id);

  const subsByTask = new Map<string, Subtask[]>();
  if (taskIds.length > 0) {
    const subs = await db
      .select({
        id: subtasks.id,
        taskId: subtasks.taskId,
        title: subtasks.title,
        notes: subtasks.notes,
      })
      .from(subtasks)
      .where(inArray(subtasks.taskId, taskIds));

    for (const s of subs) {
      const mapped: Subtask = {
        id: s.id,
        title: s.title,
        notes: s.notes ?? undefined,
      };
      const list = subsByTask.get(s.taskId) ?? [];
      list.push(mapped);
      subsByTask.set(s.taskId, list);
    }
  }

  const tasksData = results.map((row) => ({
    id: row.id,
    courseId: row.courseId,
    userId: user.id,
    title: row.title,
    notes: row.notes ?? undefined,
    type: row.type,
    status: parseStatusTask(String(row.status)),
    estimatedEffort: row.estimatedEffort,
    actualEffort: row.actualEffort,
    dueDate: row.dueDate,
    course: {
      id: row.courseId,
      code: row.courseCode,
      name: row.courseName,
      color: row.courseColor,
      daypart: row.courseDaypart,
      userId: user.id,
    },
    subtasks: subsByTask.get(row.id) ?? [],
  }));

  return NextResponse.json(tasksData, {
    headers: {
      'Cache-Control':
        'private, no-store, no-cache, must-revalidate, max-age=0',
    },
  });
});
