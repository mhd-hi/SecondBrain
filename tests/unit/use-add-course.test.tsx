import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAddCourse } from '@/hooks/course/use-add-course';
import { renderHookHost } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

const createPlanETSLinkMock = vi.fn();
const apiPostMock = vi.fn();
const normalizeTasksMock = vi.fn();
const calculateDueDateTaskForTermMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('@/hooks/use-custom-link', () => ({
  createPlanETSLink: (...args: unknown[]) => createPlanETSLinkMock(...args),
}));

vi.mock('@/lib/utils/api/api-client-util', () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

vi.mock('@/lib/utils/course/course', () => ({
  assertValidCourseCode: vi.fn((code: string) => code.trim()),
}));

vi.mock('@/lib/ai/normalize', () => ({
  normalizeTasks: (...args: unknown[]) => normalizeTasksMock(...args),
}));

vi.mock('@/lib/utils/task/task-util', () => ({
  calculateDueDateTaskForTerm: (...args: unknown[]) => calculateDueDateTaskForTermMock(...args),
}));

beforeEach(() => {
  ensureHappyDom();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  createPlanETSLinkMock.mockResolvedValue(undefined);
});

describe('useAddCourse', () => {
  it('creates AI-generated tasks after creating an ETS course', async () => {
    normalizeTasksMock.mockReturnValue([
      {
        title: 'Review chapter 1',
        notes: 'Summarize key points',
        type: 'homework',
        status: 'TODO',
        estimatedEffort: 2,
        actualEffort: 0,
        dueDate: new Date('2026-05-01T00:00:00.000Z'),
        subtasks: undefined,
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
        updatedAt: new Date('2026-04-28T00:00:00.000Z'),
      },
      {
        title: 'Complete lab 1',
        notes: undefined,
        type: 'lab',
        status: 'TODO',
        estimatedEffort: 3,
        actualEffort: 0,
        dueDate: new Date('2026-05-02T00:00:00.000Z'),
        subtasks: undefined,
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
        updatedAt: new Date('2026-04-28T00:00:00.000Z'),
      },
    ]);

    calculateDueDateTaskForTermMock
      .mockReturnValueOnce(new Date('2026-09-08T00:00:00.000Z'))
      .mockReturnValueOnce(new Date('2026-09-15T00:00:00.000Z'));

    apiPostMock
      .mockResolvedValueOnce({
        step: { status: 'success' },
        data: '<html>course data</html>',
      })
      .mockResolvedValueOnce({
        step: { status: 'success' },
        data: {
          courseCode: 'LOG210',
          term: '20263',
          tasks: [
            { week: 1, title: 'Review chapter 1', type: 'homework', estimatedEffort: 2 },
            { week: 2, title: 'Complete lab 1', type: 'lab', estimatedEffort: 3 },
          ],
        },
      })
      .mockResolvedValueOnce({ id: 'course-1' })
      .mockResolvedValueOnce(undefined);

    let hookValue!: ReturnType<typeof useAddCourse>;
    const view = renderHookHost(() => useAddCourse(), (value) => {
      hookValue = value;
    });

    try {
      await view.render();

      await act(async () => {
        await hookValue.startProcessing(
          'LOG210',
          '20263',
          new Date('2026-09-01T00:00:00.000Z'),
          'AM',
          'ets',
          'Weekly labs and quizzes',
        );
      });

      expect(apiPostMock).toHaveBeenNthCalledWith(
        4,
        '/api/tasks',
        {
          courseId: 'course-1',
          tasks: [
            expect.objectContaining({
              title: 'Review chapter 1',
              dueDate: '2026-09-08T00:00:00.000Z',
            }),
            expect.objectContaining({
              title: 'Complete lab 1',
              dueDate: '2026-09-15T00:00:00.000Z',
            }),
          ],
        },
        'Failed to create tasks',
      );
      expect(createPlanETSLinkMock).toHaveBeenCalledWith('course-1', 'LOG210', '20263');
      expect(hookValue.createdCourseId).toBe('course-1');
      expect(hookValue.stepStatus['create-tasks']).toBe('success');
      expect(toastErrorMock).not.toHaveBeenCalled();
    } finally {
      await view.unmount();
    }
  });
});
