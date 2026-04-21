import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCoursePipelinePost } from '@/app/api/course-pipeline/route';
import * as aiModule from '@/lib/ai';
import * as courseUtils from '@/lib/utils/course/course';
import * as courseQueries from '@/lib/utils/course/queries';
import * as sanitizeUtils from '@/lib/utils/sanitize';
import * as pipelines from '@/pipelines';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

vi.mock('@/lib/utils/course/course', () => ({
  assertValidCourseCode: vi.fn((code: string) => code),
}));

vi.mock('@/lib/utils/course/queries', () => ({
  findCourseByIdAndUser: vi.fn(),
  findCourseOwnershipByIdAndUser: vi.fn(),
  findTasksWithSubtasks: vi.fn(),
  findUserCourseMetadata: vi.fn(),
  findUserCourseSummaryCandidateTasks: vi.fn(),
  findUserCourseSummaryMetrics: vi.fn(),
  findUserCoursesWithTasks: vi.fn(),
  courseExists: vi.fn(),
}));

vi.mock('@/lib/utils/sanitize', () => ({
  sanitizeUserInput: vi.fn((value: string) => value),
  validateUserContext: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  runAIProvider: vi.fn(),
}));

vi.mock('@/pipelines', () => ({
  UniversityCourseDataSource: vi.fn(),
}));

beforeEach(() => {
  (courseUtils.assertValidCourseCode as unknown as Mock).mockClear();
  (courseQueries.courseExists as unknown as Mock).mockClear();
  (sanitizeUtils.sanitizeUserInput as unknown as Mock).mockClear();
  (sanitizeUtils.validateUserContext as unknown as Mock).mockClear();
  (aiModule.runAIProvider as unknown as Mock).mockClear();
  (pipelines.UniversityCourseDataSource as unknown as Mock).mockClear();
});

describe('course pipeline duplicate protection', () => {
  it('returns a conflict before starting the pipeline when the course already exists', async () => {
    (courseQueries.courseExists as unknown as Mock).mockResolvedValue({ exists: true });

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
    expect(courseUtils.assertValidCourseCode).toHaveBeenCalledWith('LOG210', 'Invalid course code format');
    expect(courseQueries.courseExists).toHaveBeenCalledWith('user-1', 'LOG210', '20253');
    expect(pipelines.UniversityCourseDataSource).not.toHaveBeenCalled();
    expect(aiModule.runAIProvider).not.toHaveBeenCalled();

    await expect(response.json()).resolves.toMatchObject({
      code: 'COURSE_EXISTS',
    });
  });
});
