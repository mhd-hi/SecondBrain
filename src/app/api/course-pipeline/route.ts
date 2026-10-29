import type {
  PipelineStepRequest,
  PipelineStepResult,
} from '@/types/server-pipelines/pipelines';
import type { AIErrorCode } from '@/lib/ai/error';
import { NextResponse } from 'next/server';
import { AIError } from '@/lib/ai/error';
import { withAuthSimple } from '@/lib/auth/api';
import { checkUserRateLimit } from '@/lib/auth/rate-limit';
import {
  assertCourseNotExists,
  CourseCreationError,
  fetchCoursePlanHtml,
  parseCoursePlanToTasks,
  validateCourseCreationInput,
} from '@/lib/courses/create-course-pipeline';
import { SCHOOL } from '@/types/school';

const AI_ROUTE_ERRORS = new Map<
  AIErrorCode,
  { status: number; message: string }
>([
  ['AI_INPUT_TOO_LARGE', {
    status: 413,
    message: 'Course-plan input is too large',
  }],
  ['AI_ABORTED', { status: 499, message: 'AI processing was cancelled' }],
  ['AI_DEADLINE_EXCEEDED', { status: 504, message: 'AI processing timed out' }],
  ['AI_PROVIDERS_EXHAUSTED', {
    status: 503,
    message: 'AI processing is temporarily unavailable',
  }],
]);

// Endpoint for step-by-step course processing
export async function handleCoursePipelinePost(
  request: Request,
  user: { id: string },
) {
  try {
    const body = (await request.json()) as PipelineStepRequest;
    const { courseCode, term, step, htmlData, userContext } = body;

    if (!term) {
      return NextResponse.json(
        { error: 'term is required', code: 'MISSING_TERM' },
        { status: 400 },
      );
    }
    if (!courseCode) {
      return NextResponse.json(
        { error: 'Missing required parameter: courseCode' },
        { status: 400 },
      );
    }

    // Shared validation (strict YYYY[1-3] term, code format, sanitized
    // context). Single source with Lucy/MCP — no duplicated checks.
    let validated: ReturnType<typeof validateCourseCreationInput>;
    try {
      validated = validateCourseCreationInput({
        courseCode,
        term,
        school: SCHOOL.ETS,
        userContext,
      });
    } catch (error) {
      if (error instanceof CourseCreationError) {
        const status =
          error.code === 'UNSUPPORTED_SCHOOL' ? 400 : 400;
        const code =
          error.code === 'INVALID_TERM'
            ? 'INVALID_TERM'
            : error.code === 'INVALID_COURSE_CODE'
              ? undefined
              : error.code;
        return NextResponse.json(
          code ? { error: error.message, code } : { error: error.message },
          { status },
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid user context',
        },
        { status: 400 },
      );
    }
    const { code: cleanCode, term: cleanTerm, sanitizedContext } = validated;

    try {
      await assertCourseNotExists(user.id, cleanCode, cleanTerm);
    } catch (error) {
      if (
        error instanceof CourseCreationError &&
        error.code === 'COURSE_EXISTS'
      ) {
        return NextResponse.json(
          {
            error: `Course ${cleanCode} already exists in your account`,
            code: 'COURSE_EXISTS',
          },
          { status: 409 },
        );
      }
      console.error('Failed to check course existence in pipeline:', error);
      return NextResponse.json(
        { error: 'Database is currently unavailable, please try again later' },
        { status: 500 },
      );
    }

    if (step === 'planets') {
      try {
        const startTime = new Date().toISOString();
        const html = await fetchCoursePlanHtml(validated);
        const data = html ?? '';
        const endTime = new Date().toISOString();

        return NextResponse.json({
          step: {
            id: 'planets',
            name: 'PlanETS Data Fetch',
            status: 'success',
            startTime,
            endTime,
            data: {
              contentLength: data.length,
              source: 'planets',
              courseCode: cleanCode,
              term: cleanTerm,
            },
          },
          data,
        } as PipelineStepResult);
      } catch (error) {
        console.error('PlanETS fetch failed:', error);
        return NextResponse.json(
          {
            step: {
              id: 'planets',
              name: 'PlanETS Data Fetch',
              status: 'error',
              error: 'Course data service is currently unavailable, please try again later',
              endTime: new Date().toISOString(),
            },
            data: null,
          } as PipelineStepResult,
          { status: 500 },
        );
      }
    }

    if (step === 'ai') {
      if (!htmlData) {
        return NextResponse.json(
          {
            error: 'Missing required parameter: htmlData for AI processing',
          },
          { status: 400 },
        );
      }

      try {
        const startTime = new Date().toISOString();
        console.log(
          '[API] AI step - User context:',
          sanitizedContext
            ? `Present (${sanitizedContext.length} chars)`
            : 'Not provided',
        );
        const tasks = await parseCoursePlanToTasks(
          htmlData,
          sanitizedContext,
          request.signal,
        );
        if (request.signal.aborted) {
          return new NextResponse(null, { status: 499 });
        }
        const endTime = new Date().toISOString();
        const courseData = {
          courseCode: cleanCode,
          term: cleanTerm,
          tasks,
        };

        return NextResponse.json({
          step: {
            id: 'ai',
            name: 'AI Processing',
            status: 'success',
            startTime,
            endTime,
            data: {
              contentLength: htmlData.length,
              courseCode: cleanCode,
              term: cleanTerm,
            },
          },
          data: courseData,
        } as PipelineStepResult);
      } catch (error) {
        if (request.signal.aborted) {
          return new NextResponse(null, { status: 499 });
        }
        if (error instanceof AIError) {
          const routeError = AI_ROUTE_ERRORS.get(error.code)!;
          return NextResponse.json(
            {
              step: {
                id: 'ai',
                name: 'AI Processing',
                status: 'error',
                error: routeError.message,
                code: error.code,
                endTime: new Date().toISOString(),
              },
              data: null,
            } as PipelineStepResult,
            { status: routeError.status },
          );
        }

        const errorMessage = 'AI service is currently unavailable, please try again later';
        console.error('AI processing failed:', error);
        return NextResponse.json(
          {
            step: {
              id: 'ai',
              name: 'AI Processing',
              status: 'error',
              error: errorMessage,
              endTime: new Date().toISOString(),
            },
            data: null,
          } as PipelineStepResult,
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid step parameter. Must be "planets" or "ai"' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error in course pipeline:', error);
    return NextResponse.json(
      {
        error: 'Service is currently unavailable, please try again later',
      },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/course-pipeline:
 *   post:
 *     summary: Run a step of the course import pipeline (fetch from Planets or process with AI)
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseCode, term, step]
 *             properties:
 *               courseCode: { type: string }
 *               term: { type: string }
 *               step: { type: string, enum: [planets, ai] }
 *               htmlData: { type: string }
 *               userContext: { type: string }
 *     responses:
 *       200:
 *         description: Pipeline step result
 *       400:
 *         description: Missing or invalid parameters
 *       409:
 *         description: Course already exists
 */
export const POST = withAuthSimple(async (request, user) => {
  const limit = checkUserRateLimit(`course-pipeline:${user.id}`, 10 * 60_000, 30);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  return handleCoursePipelinePost(request, user);
});
