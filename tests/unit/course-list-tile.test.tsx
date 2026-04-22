import * as React from 'react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComponent } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

const routerPushMock = vi.fn();
const handleConfirmMock = vi.fn();
const deleteCourseMock = vi.fn();
const refreshCoursesMock = vi.fn();
const toastErrorMock = vi.fn();
let lastDeleteCourseHandler: ((courseId: string) => Promise<void>) | null = null;

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: routerPushMock })),
}));
vi.mock('@/components/Boards/Course/CourseCard', () => ({
  default: ({ onDeleteCourse }: { onDeleteCourse: (courseId: string) => Promise<void> }) => {
    lastDeleteCourseHandler = onDeleteCourse;
    return <div>Course card</div>;
  },
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div>Loading</div>,
}));
vi.mock('@/hooks/course/use-course-store', () => ({
  useCourses: () => ({
    courses: [{ id: 'course-1', code: 'LOG210', name: 'Software Construction', color: 'blue' }],
    isLoading: false,
    refreshCourses: refreshCoursesMock,
  }),
  useCourseMutations: () => ({
    deleteCourse: deleteCourseMock,
  }),
}));
vi.mock('@/lib/utils/dialog-util', () => ({
  handleConfirm: (...args: unknown[]) => handleConfirmMock(...args),
}));

describe('CourseListTile', () => {
  beforeEach(() => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    lastDeleteCourseHandler = null;
  });

  it('reports delete failures instead of leaving the rejection unhandled', async () => {
    deleteCourseMock.mockRejectedValueOnce(new Error('delete failed'));
    handleConfirmMock.mockImplementationOnce(async (_message: string, onConfirm: () => Promise<void>) => {
      await onConfirm();
    });

    const { CourseListTile } = await import('@/components/Boards/Course/CourseListTile');
    const view = renderComponent(<CourseListTile />);

    try {
      await view.render();

      expect(lastDeleteCourseHandler).not.toBeNull();

      await act(async () => {
        await lastDeleteCourseHandler?.('course-1');
      });

      expect(handleConfirmMock).toHaveBeenCalledOnce();
      expect(deleteCourseMock).toHaveBeenCalledWith('course-1');
      expect(refreshCoursesMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to delete course. Please try again.');
    } finally {
      await view.unmount();
    }
  });
});
