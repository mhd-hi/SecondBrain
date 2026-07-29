import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIError, type AIErrorCode } from '@/lib/ai/error';

const assertValidCourseCodeMock = vi.fn((code: string) => code);
const courseExistsMock = vi.fn();
const sanitizeUserInputMock = vi.fn((value: string) => value);
const validateUserContextMock = vi.fn();
const generateCoursePlanTasksMock = vi.fn();
const schoolCourseDataSourceMock = vi.fn();

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

vi.mock('@/lib/utils/course/course', () => ({
  assertValidCourseCode: assertValidCourseCodeMock,
}));

vi.mock('@/lib/utils/course/queries', () => ({
  findCourseByIdAndUser: vi.fn(),
  findCourseOwnershipByIdAndUser: vi.fn(),
  findTasksWithSubtasks: vi.fn(),
  findUserCourseMetadata: vi.fn(),
  findUserCourseSummaryCandidateTasks: vi.fn(),
  findUserCourseSummaryMetrics: vi.fn(),
  findUserCoursesWithTasks: vi.fn(),
  courseExists: courseExistsMock,
}));

vi.mock('@/lib/utils/sanitize', () => ({
  sanitizeUserInput: sanitizeUserInputMock,
  validateUserContext: validateUserContextMock,
}));

vi.mock('@/lib/ai/course-plan', () => ({
  generateCoursePlanTasks: generateCoursePlanTasksMock,
}));

vi.mock('@/pipelines/data-sources/planets', () => ({
  SchoolCourseDataSource: schoolCourseDataSourceMock,
}));

const { handleCoursePipelinePost } =
  await import('@/app/api/course-pipeline/route');

beforeEach(() => {
  (assertValidCourseCodeMock as unknown as Mock).mockClear();
  (courseExistsMock as unknown as Mock).mockClear();
  (sanitizeUserInputMock as unknown as Mock).mockClear();
  (validateUserContextMock as unknown as Mock).mockClear();
  (generateCoursePlanTasksMock as unknown as Mock).mockClear();
  (schoolCourseDataSourceMock as unknown as Mock).mockClear();
  (courseExistsMock as unknown as Mock).mockResolvedValue({ exists: false });
});

describe('course pipeline duplicate protection', () => {
  it('returns a conflict before starting the pipeline when the course already exists', async () => {
    (courseExistsMock as unknown as Mock).mockResolvedValue({ exists: true });

    const response = await handleCoursePipelinePost(
      new Request('http://localhost/api/course-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode: 'LOG210',
          term: '20253',
          step: 'planets',
        }),
      }) as never,
      { id: 'user-1' },
    );

    expect(response.status).toBe(409);
    expect(assertValidCourseCodeMock).toHaveBeenCalledWith(
      'LOG210',
      'Invalid course code format',
    );
    expect(courseExistsMock).toHaveBeenCalledWith('user-1', 'LOG210', '20253');
    expect(schoolCourseDataSourceMock).not.toHaveBeenCalled();
    expect(generateCoursePlanTasksMock).not.toHaveBeenCalled();

    await expect(response.json()).resolves.toMatchObject({
      code: 'COURSE_EXISTS',
    });
  });
});

describe('course pipeline AI errors', () => {
  it.each([
    ['AI_INPUT_TOO_LARGE', 413, 'Course-plan input is too large'],
    ['AI_ABORTED', 499, 'AI processing was cancelled'],
    ['AI_DEADLINE_EXCEEDED', 504, 'AI processing timed out'],
    ['AI_PROVIDERS_EXHAUSTED', 503, 'AI processing is temporarily unavailable'],
  ] as const)('maps %s to a safe response', async (code, status, message) => {
    (generateCoursePlanTasksMock as unknown as Mock).mockRejectedValueOnce(
      new AIError(code as AIErrorCode),
    );
    const response = await handleCoursePipelinePost(
      new Request('http://localhost/api/course-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode: 'LOG210',
          term: '20253',
          step: 'ai',
          htmlData: '<p>provider-secret-error</p>',
        }),
      }),
      { id: 'user-1' },
    );

    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).toMatchObject({
      step: { code, error: message },
      data: null,
    });
    expect(JSON.stringify(body)).not.toContain('provider-secret-error');
  });
});
