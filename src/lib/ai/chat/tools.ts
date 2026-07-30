import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { and, asc, eq, gte, ilike, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { courses, tasks } from '@/server/db/schema';
import { StatusTask } from '@/types/status-task';
import {
  addDateOnlyDays,
  resolveTermWeekDates,
  torontoDateAtHour,
} from './date';

const MAX_TOOL_RESULTS = 100;
export const MAX_PLANNER_NOTES_CHARACTERS = 12_000;

const searchCoursesSchema = z.strictObject({
  query: z.string().trim().max(300),
});
const searchTasksSchema = z.strictObject({
  query: z.string().trim().max(300),
  courseId: z.uuid().optional(),
  status: z.enum(StatusTask).optional(),
  dateRange: z
    .strictObject({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
  limit: z.number().int().min(1).max(20).default(20),
});
const taskIdSchema = z.strictObject({ taskId: z.uuid() });
const courseIdSchema = z.strictObject({ courseId: z.uuid() });
const courseWeekSchema = z.strictObject({
  courseId: z.uuid(),
  week: z.number().int().min(1).max(13),
});

export const CHAT_READ_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_courses',
      description:
        'Find the authenticated user’s courses by code or name, including empty courses.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: { query: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tasks',
      description:
        'Search owned tasks with optional course, status, and Toronto date filters.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: {
          query: { type: 'string' },
          courseId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: Object.values(StatusTask) },
          dateRange: {
            type: 'object',
            additionalProperties: false,
            required: ['start', 'end'],
            properties: {
              start: { type: 'string', format: 'date' },
              end: { type: 'string', format: 'date' },
            },
          },
          limit: { type: 'integer', minimum: 1, maximum: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_task',
      description: 'Load one owned task with full notes.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['taskId'],
        properties: { taskId: { type: 'string', format: 'uuid' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_course_tasks',
      description: 'List owned tasks for one owned course.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['courseId'],
        properties: { courseId: { type: 'string', format: 'uuid' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_course_week',
      description:
        'Resolve a numbered course week to authoritative calendar dates. Always use this for "week N" or "semaine N".',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['courseId', 'week'],
        properties: {
          courseId: { type: 'string', format: 'uuid' },
          week: { type: 'integer', minimum: 1, maximum: 13 },
        },
      },
    },
  },
];

export type NotesBudget = { remaining: number };

function checkSignal(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason;
  }
}

function taskProjection() {
  return {
    id: tasks.id,
    courseId: tasks.courseId,
    courseCode: courses.code,
    courseName: courses.name,
    title: tasks.title,
    notes: tasks.notes,
    dueDate: tasks.dueDate,
    status: tasks.status,
    type: tasks.type,
    estimatedEffort: tasks.estimatedEffort,
    actualEffort: tasks.actualEffort,
    updatedAt: tasks.updatedAt,
  };
}

function budgetNotes<T extends { notes: string | null }>(
  rows: T[],
  budget: NotesBudget,
) {
  return rows.map((row) => {
    if (!row.notes || budget.remaining <= 0) {
      return { ...row, notes: undefined };
    }
    const notes = row.notes.slice(0, budget.remaining);
    budget.remaining -= notes.length;
    return { ...row, notes };
  });
}

function compactNotes<T extends { notes: string | null }>(rows: T[]) {
  return rows.map((row) => ({ ...row, notes: undefined }));
}

async function searchCourses(userId: string, input: unknown) {
  const { query } = searchCoursesSchema.parse(input);
  const match = `%${query}%`;
  return db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      term: courses.term,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(
      and(
        eq(courses.userId, userId),
        or(ilike(courses.code, match), ilike(courses.name, match)),
      ),
    )
    .orderBy(asc(courses.code))
    .limit(20);
}

async function searchTasks(
  userId: string,
  input: unknown,
) {
  const parsed = searchTasksSchema.parse(input);
  const filters = [eq(tasks.userId, userId)];
  if (parsed.query) {
    filters.push(ilike(tasks.title, `%${parsed.query}%`));
  }
  if (parsed.courseId) {
    filters.push(eq(tasks.courseId, parsed.courseId));
  }
  if (parsed.status) {
    filters.push(eq(tasks.status, parsed.status));
  }
  if (parsed.dateRange) {
    filters.push(
      gte(tasks.dueDate, torontoDateAtHour(parsed.dateRange.start, 0)),
    );
    const afterEnd = torontoDateAtHour(
      addDateOnlyDays(parsed.dateRange.end, 1),
      0,
    );
    filters.push(lt(tasks.dueDate, afterEnd));
  }

  const rows = await db
    .select(taskProjection())
    .from(tasks)
    .innerJoin(courses, eq(tasks.courseId, courses.id))
    .where(and(...filters))
    .orderBy(asc(tasks.dueDate), asc(tasks.id))
    .limit(parsed.limit);
  return compactNotes(rows);
}

async function getTask(userId: string, input: unknown, budget: NotesBudget) {
  const { taskId } = taskIdSchema.parse(input);
  const rows = await db
    .select(taskProjection())
    .from(tasks)
    .innerJoin(courses, eq(tasks.courseId, courses.id))
    .where(and(eq(tasks.userId, userId), eq(tasks.id, taskId)))
    .limit(1);
  if (!rows[0]) {
    throw new Error('Task not found');
  }
  return budgetNotes(rows, budget)[0]!;
}

async function listCourseTasks(
  userId: string,
  input: unknown,
) {
  const { courseId } = courseIdSchema.parse(input);
  const ownedCourse = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);
  if (!ownedCourse[0]) {
    throw new Error('Course not found');
  }
  const rows = await db
    .select(taskProjection())
    .from(tasks)
    .innerJoin(courses, eq(tasks.courseId, courses.id))
    .where(and(eq(tasks.userId, userId), eq(tasks.courseId, courseId)))
    .orderBy(asc(tasks.dueDate), asc(tasks.id))
    .limit(MAX_TOOL_RESULTS);
  return compactNotes(rows);
}

async function resolveCourseWeek(userId: string, input: unknown) {
  const { courseId, week } = courseWeekSchema.parse(input);
  const course = await db
    .select({ id: courses.id, term: courses.term })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1)
    .then((rows) => rows[0]);
  if (!course) {
    throw new Error('Course not found');
  }

  return {
    courseId,
    term: course.term,
    week,
    dates: resolveTermWeekDates(course.term, week),
  };
}

export async function executeReadTool({
  name,
  argumentsJson,
  userId,
  budget,
  signal,
}: {
  name: string;
  argumentsJson: string;
  userId: string;
  budget: NotesBudget;
  signal?: AbortSignal;
}) {
  checkSignal(signal);
  const input: unknown = JSON.parse(argumentsJson);
  let result: unknown;

  switch (name) {
    case 'search_courses':
      result = await searchCourses(userId, input);
      break;
    case 'search_tasks':
      result = await searchTasks(userId, input);
      break;
    case 'get_task':
      result = await getTask(userId, input, budget);
      break;
    case 'list_course_tasks':
      result = await listCourseTasks(userId, input);
      break;
    case 'resolve_course_week':
      result = await resolveCourseWeek(userId, input);
      break;
    default:
      throw new Error('Unknown tool');
  }

  checkSignal(signal);
  return result;
}
