import type { TEvent } from '@/calendar/types';
import type { StatusTask } from '@/types/status-task';
import type { Task } from '@/types/task';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { taskToEvent } from '@/calendar/event-utils';
import { AuthorizationError } from '@/lib/auth/api';
import { db } from '@/server/db';
import { courses, tasks } from '@/server/db/schema';

type TaskRow = {
  tasks: {
    id: string;
    courseId: string;
    title: string;
    notes?: string | null;
    type: string;
    status: StatusTask;
    estimatedEffort: number;
    actualEffort: number;
    createdAt: Date;
    updatedAt: Date;
    dueDate: Date;
  };
  courses?: {
    id: string;
    userId: string;
    name: string;
    code: string;
    term: string;
    color: string;
    daypart: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

export const getTasksForWeek = async (startDate: Date, endDate: Date, userId: string): Promise<Task[]> => {
  try {
    if (!userId) {
      throw new Error('User authentication required');
    }

    const conditions = [
      gte(tasks.dueDate, startDate),
      lt(tasks.dueDate, endDate),
      eq(tasks.userId, userId),
    ];

    const results = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .leftJoin(courses, eq(tasks.courseId, courses.id));

    const taskRows = results as TaskRow[];

    return taskRows.map((row) => {
      const t = row.tasks;
      const course = row.courses ?? undefined;
      return {
        id: t.id,
        courseId: t.courseId,
        title: t.title,
        notes: t.notes ?? undefined,
        type: t.type as Task['type'],
        status: t.status,
        estimatedEffort: t.estimatedEffort,
        actualEffort: t.actualEffort,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        dueDate: t.dueDate,
        course,
      } as Task;
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

export const updateStatusTask = async (taskId: string, status: StatusTask, userId: string) => {
  if (!userId) {
    throw new Error('User authentication required');
  }

  const conditions = [
    eq(tasks.id, taskId),
    eq(tasks.userId, userId),
  ];

  const updatedTasks = await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(and(...conditions))
    .returning();

  if (!updatedTasks.length) {
    throw new AuthorizationError('Task not found or access denied');
  }

  return updatedTasks;
};

export const batchUpdateStatusTask = async (taskIds: string[], status: StatusTask, userId: string) => {
  if (!userId) {
    throw new Error('User authentication required');
  }

  if (!taskIds.length) {
    return [];
  }

  const conditions = [
    inArray(tasks.id, taskIds),
    eq(tasks.userId, userId),
  ];

  return db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(and(...conditions))
    .returning();
};

export const getCalendarEvents = async (startDate: Date, endDate: Date, userId: string): Promise<TEvent[]> => {
  try {
    if (!userId) {
      throw new Error('User authentication required');
    }

    // Fetch tasks
    const taskConditions = [
      gte(tasks.dueDate, startDate),
      lt(tasks.dueDate, endDate),
      eq(tasks.userId, userId),
    ];

    const taskResults = await db
      .select({
        id: tasks.id,
        courseId: tasks.courseId,
        title: tasks.title,
        notes: tasks.notes,
        type: tasks.type,
        status: tasks.status,
        estimatedEffort: tasks.estimatedEffort,
        actualEffort: tasks.actualEffort,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        dueDate: tasks.dueDate,
        course: {
          id: courses.id,
          color: courses.color,
          daypart: courses.daypart,
          code: courses.code,
          name: courses.name,
          createdAt: courses.createdAt,
          updatedAt: courses.updatedAt,
        },
      })
      .from(tasks)
      .innerJoin(courses, eq(tasks.courseId, courses.id))
      .where(and(...taskConditions));

    // Convert tasks to events using the utility function
    const taskEvents = taskResults.map((row) => {
      const task: Task = {
        id: row.id,
        courseId: row.courseId,
        title: row.title,
        notes: row.notes ?? undefined,
        type: row.type as Task['type'],
        status: row.status as StatusTask,
        estimatedEffort: row.estimatedEffort,
        actualEffort: row.actualEffort,
        dueDate: row.dueDate,
        course: {
          id: row.course.id,
          color: row.course.color,
          daypart: row.course.daypart,
          code: row.course.code,
          name: row.course.name,
        },
      };

      return taskToEvent(task);
    });

    return [...taskEvents];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw new Error('Failed to fetch calendar events');
  }
};
