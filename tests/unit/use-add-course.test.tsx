import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAddCourse } from '../../src/hooks/course/use-add-course';
import { renderHookHost } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

const toastErrorMock = vi.fn();
const originalFetch = globalThis.fetch;

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  ensureHappyDom();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  setFetchMock(originalFetch);
});

describe('useAddCourse', () => {
  it('creates AI-generated tasks after creating an ETS course', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          step: { status: 'success' },
          data: '<html>course data</html>',
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          step: { status: 'success' },
          data: {
            courseCode: 'LOG210',
            term: '20263',
            tasks: [
              { week: 1, title: 'Review chapter 1', type: 'homework', estimatedEffort: 2, notes: 'Summarize key points' },
              { week: 2, title: 'Complete lab 1', type: 'lab', estimatedEffort: 3 },
            ],
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'course-1' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          customLink: {
            id: 'custom-link-1',
            title: 'planets',
            url: 'https://example.com/planets',
            type: 'planets',
            courseId: 'course-1',
            userId: 'user-1',
            createdAt: new Date('2026-04-28T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-28T00:00:00.000Z').toISOString(),
          },
        }),
      } as unknown as Response);
    setFetchMock(fetchMock as unknown as typeof fetch);

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

      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        '/api/tasks',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
      expect(JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string)).toEqual({
        courseId: 'course-1',
        tasks: [
          expect.objectContaining({
            title: 'Review chapter 1',
            dueDate: '2026-09-01T00:00:00.000Z',
          }),
          expect.objectContaining({
            title: 'Complete lab 1',
            dueDate: '2026-09-08T00:00:00.000Z',
          }),
        ],
      });
      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(hookValue.createdCourseId).toBe('course-1');
      expect(hookValue.stepStatus['create-tasks']).toBe('success');
      expect(toastErrorMock).not.toHaveBeenCalled();
    } finally {
      await view.unmount();
      setFetchMock(originalFetch);
    }
  });
});
