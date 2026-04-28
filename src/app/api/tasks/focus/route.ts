import type { Subtask } from '@/types/subtask';
import { and, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { parseStatusTask } from '@/lib/utils/task/task-util';
import { db } from '@/server/db';
import { courses, subtasks, tasks } from '@/server/db/schema';
import { StatusTask } from '@/types/status-task';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthSimple(
  async (request, user) => {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') ?? 'week'; // week, month, quarter

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    let endDate: Date;

    switch (filter) {
      case 'month':
        endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 1);
        break;
      case 'quarter':
        endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 3);
        break;
      default: // week
        endDate = new Date(now);
        endDate.setDate(now.getDate() + 7);
        break;
    }

    // Fetch tasks with selected fields only
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
      })
      .from(tasks)
      .innerJoin(courses, eq(tasks.courseId, courses.id))
      .where(
        and(
          eq(tasks.userId, user.id),
          or(
            // Overdue tasks (not completed)
            and(
              lt(tasks.dueDate, now),
              sql`${tasks.status} <> ${StatusTask.COMPLETED}`,
            ),
            // Tasks due within filter range that are actionable
            and(
              gte(tasks.dueDate, now),
              lt(tasks.dueDate, endDate),
              or(
                eq(tasks.status, StatusTask.IN_PROGRESS),
                eq(tasks.status, StatusTask.TODO),
              ),
            ),
          ),
        ),
      );

    const taskIds = results.map(r => r.id);

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

    const tasksData = results.map(row => ({
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
        userId: user.id,
      },
      subtasks: subsByTask.get(row.id) ?? [],
    }));

    return NextResponse.json(tasksData, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  },
);
