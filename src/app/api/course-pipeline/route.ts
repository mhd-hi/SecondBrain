import type {
  PipelineStepRequest,
  PipelineStepResult,
} from '@/types/server-pipelines/pipelines';
import { NextResponse } from 'next/server';
import { runAIProvider } from '@/lib/ai';
import { withAuthSimple } from '@/lib/auth/api';
import { assertValidCourseCode } from '@/lib/utils/course/course';
import { courseExists } from '@/lib/utils/course/queries';
import { sanitizeUserInput, validateUserContext } from '@/lib/utils/sanitize';
import { UniversityCourseDataSource } from '@/pipelines';
import { UNIVERSITY } from '@/types/university';

// Endpoint for step-by-step course processing
export async function handleCoursePipelinePost(request: Request, user: { id: string }) {
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

    // Validate and sanitize userContext
    let sanitizedContext: string | undefined;
    if (userContext) {
      try {
        validateUserContext(userContext);
        sanitizedContext = sanitizeUserInput(userContext);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error ? error.message : 'Invalid user context',
          },
          { status: 400 },
        );
      }
    }

    // Validate course code format
    let cleanCode: string;
    try {
      cleanCode = assertValidCourseCode(
        courseCode,
        'Invalid course code format',
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Invalid course code format',
        },
        { status: 400 },
      );
    }

    try {
      const existsResult = await courseExists(user.id, cleanCode, term);
      if (existsResult.exists) {
        return NextResponse.json(
          { error: `Course ${cleanCode} already exists in your account`, code: 'COURSE_EXISTS' },
          { status: 409 },
        );
      }
    } catch (err) {
      console.error('Failed to check course existence in pipeline:', err);
      return NextResponse.json({ error: 'Failed to check course existence' }, { status: 500 });
    }

    if (step === 'planets') {
      try {
        const startTime = new Date().toISOString();
        const planetsSource = new UniversityCourseDataSource(UNIVERSITY.ETS);
        const result = await planetsSource.fetch(cleanCode, term);
        const endTime = new Date().toISOString();

        // Validate that we have meaningful content
        if (!result.data || result.data.trim().length < 100) {
          throw new Error('Course data appears to be empty or invalid');
        }

        return NextResponse.json({
          step: {
            id: 'planets',
            name: 'PlanETS Data Fetch',
            status: 'success',
            startTime,
            endTime,
            data: {
              contentLength: result.data.length,
              source: 'planets',
              courseCode: cleanCode,
              term,
            },
          },
          data: result.data,
        } as PipelineStepResult);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? `Failed to fetch course data: ${error.message}`
            : 'Failed to fetch course data from Planets';

        return NextResponse.json(
          {
            step: {
              id: 'planets',
              name: 'PlanETS Data Fetch',
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
        const result = await runAIProvider(htmlData, sanitizedContext);
        const endTime = new Date().toISOString();
        const courseData = {
          courseCode: cleanCode,
          term,
          tasks: result.tasks,
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
              term,
            },
          },
          data: courseData,
        } as PipelineStepResult);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? `Failed to process with AI: ${error.message}`
            : 'Failed to process with AI';
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
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

export const POST = withAuthSimple(handleCoursePipelinePost);
