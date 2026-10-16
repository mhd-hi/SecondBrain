// @vitest-environment node
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const courseExistsMock = vi.fn();
const generateCoursePlanTasksMock = vi.fn();
const schoolFetchMock = vi.fn();

vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/db/schema', () => ({}));
vi.mock('@/lib/utils/course/queries', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/utils/course/queries')>();
  return { ...mod, courseExists: courseExistsMock };
});
vi.mock('@/lib/ai/course-plan', () => ({
  generateCoursePlanTasks: generateCoursePlanTasksMock,
}));
vi.mock('@/pipelines/data-sources/planets', () => {
  // Class (not arrow): production instantiates it with `new`.
  class FakeSchoolCourseDataSource {
    fetch = schoolFetchMock;
  }
  return { SchoolCourseDataSource: FakeSchoolCourseDataSource };
});

const { DraftValidationError, prepareDraft } = await import(
  '@/lib/ai/chat/drafts'
);
const { plannerOutputSchema } = await import('@/lib/ai/chat/types');

const courseOutput = (
  course: { code: string; term: string; school: 'ets' | 'none' },
  tasks: never[] = [],
) => {
  const output = plannerOutputSchema.parse({
    kind: 'draft',
    message: 'Create PHY335',
    summary: 'Create PHY335',
    reason: 'User asked',
    actions: [{ type: 'create_course', course, tasks }],
  });
  if (output.kind !== 'draft') throw new Error('expected draft');
  return output;
};

beforeEach(() => {
  courseExistsMock.mockReset().mockResolvedValue({ exists: false });
  generateCoursePlanTasksMock.mockReset().mockResolvedValue({
    tasks: [{ week: 1, type: 'theorie', title: 'Intro', estimatedEffort: 2 }],
  });
  schoolFetchMock.mockReset().mockResolvedValue({ data: 'x'.repeat(500) });
});

describe('prepareDraft create_course path', () => {
  it('freezes server-generated tasks and reports courses:1', async () => {
    const prepared = await prepareDraft(
      'user-1',
      courseOutput({ code: 'phy335', term: '20263', school: 'ets' }),
    );

    expect(prepared.payload.payloadVersion).toBe(2);

    const action = prepared.payload.actions[0];

    expect(action).toMatchObject({ type: 'create_course' });

    if (action?.type !== 'create_course') throw new Error('expected course action');

    // Code normalized; model tasks discarded, pipeline tasks frozen with dates.
    expect(action.course.code).toBe('PHY335');
    expect(action.tasks).toHaveLength(1);
    expect(action.tasks[0]).toMatchObject({ title: 'Intro' });
    expect(action.tasks[0]!.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(prepared.reviewPayload.counts).toMatchObject({
      adds: 0,
      updates: 0,
      deletes: 0,
      courses: 1,
    });
    expect(prepared.reviewPayload.items[0]).toMatchObject({
      type: 'create_course',
      courseCode: 'PHY335',
    });
  });

  it('maps duplicates to DraftValidationError before any fetch', async () => {
    (courseExistsMock as unknown as Mock).mockResolvedValue({ exists: true });

    await expect(
      prepareDraft('user-1', courseOutput({ code: 'PHY335', term: '20263', school: 'ets' })),
    ).rejects.toBeInstanceOf(DraftValidationError);
    expect(schoolFetchMock).not.toHaveBeenCalled();
  });

  it('creates empty previews for school=none with a warning', async () => {
    const prepared = await prepareDraft(
      'user-1',
      courseOutput({ code: 'MAT100', term: '20263', school: 'none' }),
    );
    const action = prepared.payload.actions[0];
    if (action?.type !== 'create_course') throw new Error('expected course action');

    expect(action.tasks).toEqual([]);
    expect(prepared.reviewPayload.items[0]!.warnings).toHaveLength(1);
    expect(generateCoursePlanTasksMock).not.toHaveBeenCalled();
  });

  it('rejects invalid identity as DraftValidationError', async () => {
    // Bypass plannerOutputSchema (unvalidated direct caller, e.g. MCP): the
    // schema itself already rejects H2025, prepareDraft fails closed too.
    const unvalidated = {
      kind: 'draft',
      message: 'Create PHY335',
      summary: 'Create PHY335',
      reason: 'User asked',
      actions: [
        { type: 'create_course', course: { code: 'PHY335', term: 'H2025', school: 'ets' }, tasks: [] },
      ],
    } as never;

    await expect(prepareDraft('user-1', unvalidated)).rejects.toBeInstanceOf(
      DraftValidationError,
    );
  });
});
