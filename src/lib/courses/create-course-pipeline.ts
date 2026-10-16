import { sql } from 'drizzle-orm';
import { normalizeTasks } from '@/lib/ai/normalize';
import { assertValidCourseCode } from '@/lib/utils/course/course';
import { courseExists } from '@/lib/utils/course/queries';
import { sanitizeUserInput, validateUserContext } from '@/lib/utils/sanitize';
import { calculateDueDateTaskForTerm } from '@/lib/utils/task/task-util';
import { DEFAULT_TASK_ESTIMATED_EFFORT } from '@/lib/utils/task/task-draft';
import {
  buildTerm,
  getDatesForTerm,
  isValidTermId,
  parseTermId,
} from '@/lib/utils/term-util';
import { SchoolCourseDataSource } from '@/pipelines/data-sources/planets';
import { SCHOOL } from '@/types/school';
import type { SchoolId } from '@/types/school';
import type { Daypart } from '@/types/course';
import type { AITask } from '@/types/api/ai';
// Type-only: erased at runtime, so unit tests that never touch the database
// do not evaluate the server env (DATABASE_URL) module graph.
import type { db as dbType } from '@/server/db';

export const COURSE_PLAN_MIN_HTML_LENGTH = 100;
export const COURSE_WEEK_MIN = 1;
export const COURSE_WEEK_MAX = 13;

export type CourseCreationInput = {
  courseCode: string;
  term: string;
  school: SchoolId;
  daypart?: Daypart;
  firstDayOfClass?: Date | string;
  userContext?: string;
  courseName?: string;
};

export type ValidatedCourseCreation = {
  code: string;
  name: string;
  term: string;
  school: SchoolId;
  daypart: Daypart;
  firstDayOfClass: Date | undefined;
  sanitizedContext: string | undefined;
};

export class CourseCreationError extends Error {
  constructor(
    readonly code:
      | 'INVALID_COURSE_CODE'
      | 'INVALID_TERM'
      | 'UNSUPPORTED_SCHOOL'
      | 'INVALID_DAYPART'
      | 'COURSE_EXISTS'
      | 'EMPTY_COURSE_DATA'
      | 'FETCH_FAILED'
      | 'INVALID_WEEK',
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CourseCreationError';
  }
}

const DAYPARTS: readonly Daypart[] = ['EVEN', 'AM', 'PM'];

function parseFirstDay(value: ValidatedCourseCreation['firstDayOfClass'] | Date | string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Shared validation for every course-creation entry point (UI pipeline route,
 * Lucy drafts, MCP tools). Strict term check: YYYY[1-3] only — session codes
 * like H2025 are rejected here before they reach getDatesForTerm.
 */
export function validateCourseCreationInput(input: CourseCreationInput): ValidatedCourseCreation {
  let code: string;
  try {
    code = assertValidCourseCode(input.courseCode, 'Invalid course code format');
  } catch (error) {
    throw new CourseCreationError(
      'INVALID_COURSE_CODE',
      error instanceof Error ? error.message : 'Invalid course code format',
      error,
    );
  }

  const term = typeof input.term === 'string' ? input.term.trim() : '';
  if (!isValidTermId(term)) {
    throw new CourseCreationError(
      'INVALID_TERM',
      `Invalid term format: expected YYYY[1-3] (e.g. 20263), got "${input.term}"`,
    );
  }

  if (input.school !== SCHOOL.ETS && input.school !== SCHOOL.NONE) {
    throw new CourseCreationError(
      'UNSUPPORTED_SCHOOL',
      `Unsupported school: ${String(input.school)}. Supported: ${SCHOOL.ETS}, ${SCHOOL.NONE}`,
    );
  }

  const daypart = input.daypart ?? 'AM';
  if (!DAYPARTS.includes(daypart)) {
    throw new CourseCreationError('INVALID_DAYPART', `Invalid daypart: ${String(daypart)}`);
  }

  let sanitizedContext: string | undefined;
  if (input.userContext) {
    try {
      validateUserContext(input.userContext);
      sanitizedContext = sanitizeUserInput(input.userContext) || undefined;
    } catch (error) {
      // sanitizeUserInput throws on prompt-injection patterns — rethrow as-is
      // so callers map it to a 400 without leaking details.
      throw error instanceof CourseCreationError
        ? error
        : error;
    }
  }

  const name = (input.courseName ?? code).trim() || code;

  return {
    code,
    name,
    term,
    school: input.school,
    daypart,
    firstDayOfClass: parseFirstDay(input.firstDayOfClass),
    sanitizedContext,
  };
}

function termLabelFor(termId: string): string {
  const { year, trimester } = parseTermId(termId);
  return buildTerm({ trimester, year }).label;
}

/**
 * FK guard (blocker #1): courses.term references terms.id. Every writer must
 * upsert the term row first — previously only the UI did this via a separate
 * GET /api/terms/exists call, so MCP/Lucy inserts would 500 on new terms.
 */
export async function ensureTermExists(termId: string): Promise<void> {
  if (!isValidTermId(termId)) {
    throw new CourseCreationError('INVALID_TERM', `Invalid term id: ${termId}`);
  }
  // Lazy import: keeps server env (DATABASE_URL) out of unit-test module graph
  // for callers that only use the pure validate/fetch/parse helpers.
  const { db } = await import('@/server/db');
  const label = termLabelFor(termId);
  await db.execute(sql`
    INSERT INTO terms (id, label, created_at)
    VALUES (${termId}, ${label}, NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
}

export type CoursePipelineExecutor = Pick<typeof dbType, 'execute'>;

export async function ensureTermExistsWithExecutor(
  executor: CoursePipelineExecutor,
  termId: string,
): Promise<void> {
  if (!isValidTermId(termId)) {
    throw new CourseCreationError('INVALID_TERM', `Invalid term id: ${termId}`);
  }
  const label = termLabelFor(termId);
  await executor.execute(sql`
    INSERT INTO terms (id, label, created_at)
    VALUES (${termId}, ${label}, NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function assertCourseNotExists(userId: string, code: string, term: string): Promise<void> {
  const { exists } = await courseExists(userId, code, term);
  if (exists) {
    throw new CourseCreationError('COURSE_EXISTS', `Course ${code} already exists in your account`);
  }
}

/**
 * School-routed fetch (blocker: never generic web-fetch). ETS → PlanETS
 * strategy; NONE → null (empty-course shell, no tasks).
 */
export async function fetchCoursePlanHtml(validated: ValidatedCourseCreation): Promise<string | null> {
  if (validated.school !== SCHOOL.ETS) {
    return null;
  }
  const source = new SchoolCourseDataSource(SCHOOL.ETS);
  let html: string;
  try {
    const result = await source.fetch(validated.code, validated.term);
    html = result.data;
  } catch (error) {
    throw new CourseCreationError(
      'FETCH_FAILED',
      'Course data service is currently unavailable, please try again later',
      error,
    );
  }
  if (!html || html.trim().length < COURSE_PLAN_MIN_HTML_LENGTH) {
    throw new CourseCreationError('EMPTY_COURSE_DATA', 'Course data appears to be empty or invalid');
  }
  return html;
}

export async function parseCoursePlanToTasks(
  html: string,
  userContext?: string,
  signal?: AbortSignal,
): Promise<AITask[]> {
  // Lazy import: the AI call chain (client/providers) reads server env at
  // module top. Static-importing it would drag env into every importer of
  // this module (e.g. metadata-only MCP tests). Cached after first call.
  const { generateCoursePlanTasks } = await import('@/lib/ai/course-plan');
  const { tasks } = await generateCoursePlanTasks(html, userContext, signal);
  return tasks;
}

export type BuiltCourseTask = {
  title: string;
  notes?: string;
  type: AITask['type'];
  status: 'TODO';
  estimatedEffort: number;
  actualEffort: number;
  subtasks?: Array<{ id: string; title: string; notes?: string }>;
  dueDate: Date;
  week: number;
};

/**
 * Week/effort hardening (blocker: silent clamps). Rejects out-of-range weeks
 * instead of piling tasks on term-end; coerces 0/NaN effort to default 3.
 */
export function buildCourseTasks(
  aiTasks: AITask[],
  term: string,
  firstDayOfClass?: Date,
): BuiltCourseTask[] {
  const normalized = normalizeTasks(aiTasks);
  const baseDate = firstDayOfClass ?? getDatesForTerm(term).start;
  const normalizedTasks = normalized[Symbol.iterator]();
  return aiTasks.map((aiTask) => {
    const nextTask = normalizedTasks.next();
    if (nextTask.done) {
      throw new Error('Task normalization lost an input task');
    }
    const task = nextTask.value;
    const week = typeof aiTask?.week === 'number' ? aiTask.week : 1;
    if (!Number.isInteger(week) || week < COURSE_WEEK_MIN || week > COURSE_WEEK_MAX) {
      throw new CourseCreationError(
        'INVALID_WEEK',
        `Invalid week ${String(aiTask?.week)} for task "${task.title}": expected 1-${COURSE_WEEK_MAX}`,
      );
    }
    const dueDate = calculateDueDateTaskForTerm(term, week, baseDate);
    const rawEffort = task.estimatedEffort;
    const estimatedEffort =
      typeof rawEffort === 'number' && Number.isFinite(rawEffort) && rawEffort > 0
        ? rawEffort
        : DEFAULT_TASK_ESTIMATED_EFFORT;
    return {
      title: task.title,
      notes: task.notes,
      type: task.type,
      status: 'TODO' as const,
      estimatedEffort,
      actualEffort: 0,
      subtasks: task.subtasks,
      dueDate,
      week,
    };
  });
}

export type CoursePreview = {
  course: { code: string; name: string; term: string; school: SchoolId; daypart: Daypart };
  tasks: BuiltCourseTask[];
  source: 'planets' | 'empty';
  htmlLength: number;
};

/**
 * Preview used by drafts (no writes): validates, duplicate-checks, fetches,
 * parses, builds tasks. Writers (executor) re-run the pure build step inside
 * the transaction from stored AI tasks.
 */
export async function previewCourseCreation(
  userId: string,
  input: CourseCreationInput,
  signal?: AbortSignal,
): Promise<CoursePreview> {
  const validated = validateCourseCreationInput(input);
  await assertCourseNotExists(userId, validated.code, validated.term);
  const html = await fetchCoursePlanHtml(validated);
  if (html === null) {
    return {
      course: {
        code: validated.code,
        name: validated.name,
        term: validated.term,
        school: validated.school,
        daypart: validated.daypart,
      },
      tasks: [],
      source: 'empty',
      htmlLength: 0,
    };
  }
  const aiTasks = await parseCoursePlanToTasks(html, validated.sanitizedContext, signal);
  const tasks = buildCourseTasks(aiTasks, validated.term, validated.firstDayOfClass);
  return {
    course: {
      code: validated.code,
      name: validated.name,
      term: validated.term,
      school: validated.school,
      daypart: validated.daypart,
    },
    tasks,
    source: 'planets',
    htmlLength: html.length,
  };
}
