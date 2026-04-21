import type { Mock } from 'vitest';
import * as nextNavigation from 'next/navigation';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddCoursePage from '@/app/(dashboard)/courses/add/page';
import * as courseInputFormModule from '@/components/shared/dialogs/CourseInputForm';
import * as addCourseHook from '@/hooks/course/use-add-course';
import * as courseStoreHooks from '@/hooks/course/use-course-store';
import * as termsHook from '@/hooks/use-terms';
import { useAddCourseFormStore } from '@/lib/stores/add-course-form-store';
import { ensureHappyDom } from '../helpers/runtime';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/courses/add'),
  useRouter: vi.fn(),
}));

vi.mock('@/hooks/use-terms', () => ({
  useTerms: vi.fn(),
}));

vi.mock('@/hooks/course/use-course-store', () => ({
  useCourseOperations: vi.fn(),
  useCourses: vi.fn(),
}));

vi.mock('@/hooks/course/use-add-course', () => ({
  useAddCourse: vi.fn(),
}));

vi.mock('@/components/shared/dialogs/CourseInputForm', () => ({
  CourseInputForm: vi.fn(() => null),
}));

vi.mock('@/components/shared/dialogs/ActionButtons', () => ({
  ActionButtons: () => null,
}));

vi.mock('@/components/shared/dialogs/ProcessingSteps', () => ({
  ProcessingSteps: () => null,
}));

function renderPage() {
  const container = document.createElement('div');
  const root = createRoot(container);

  return {
    container,
    root,
    render: async () => {
      // We mount through ReactDOM directly in this test helper, so manual act is required.
      // eslint-disable-next-line testing-library/no-unnecessary-act
      await act(async () => {
        root.render(<AddCoursePage />);
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

beforeEach(() => {
  ensureHappyDom();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (nextNavigation.useRouter as unknown as Mock).mockReturnValue({ push: vi.fn() });
  (courseInputFormModule.CourseInputForm as unknown as Mock).mockClear();
  useAddCourseFormStore.getState().reset();
  (courseStoreHooks.useCourses as unknown as Mock).mockReturnValue({
    courses: [],
    coursesListItems: [],
    isLoading: false,
    error: null,
    refreshCourses: vi.fn(),
    getCourse: vi.fn(),
    getCourseByCode: vi.fn(),
  });
  (addCourseHook.useAddCourse as unknown as Mock).mockReturnValue({
    currentStep: 'idle',
    stepStatus: {
      'planets': 'pending',
      'ai': 'pending',
      'create-course': 'pending',
      'create-tasks': 'pending',
    },
    parsedData: null,
    createdCourseId: null,
    error: null,
    isProcessing: false,
    startProcessing: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  });
});

afterEach(() => {
  useAddCourseFormStore.getState().reset();
  vi.clearAllMocks();
});

describe('add course page terms flow', () => {
  it('fetches terms when the hook has no terms loaded yet', async () => {
    const fetchTerms = vi.fn().mockResolvedValue([
      { id: '20251', label: 'Hiver 2025' },
      { id: '20252', label: 'Été 2025' },
      { id: '20253', label: 'Automne 2025' },
    ]);

    (termsHook.useTerms as unknown as Mock).mockReturnValue({
      terms: [],
      loading: false,
      error: null,
      fetchTerms,
    });

    const view = renderPage();
    try {
      await view.render();

      expect(fetchTerms).toHaveBeenCalledTimes(1);
    } finally {
      await view.unmount();
    }
  });

  it('does not refetch terms while the hook is already loading', async () => {
    const fetchTerms = vi.fn();

    (termsHook.useTerms as unknown as Mock).mockReturnValue({
      terms: [],
      loading: true,
      error: null,
      fetchTerms,
    });

    const view = renderPage();
    try {
      await view.render();

      expect(fetchTerms).not.toHaveBeenCalled();
    } finally {
      await view.unmount();
    }
  });

  it('defaults the shared add-course form store to the middle term from the hook', async () => {
    const terms = [
      { id: '20251', label: 'Hiver 2025' },
      { id: '20252', label: 'Été 2025' },
      { id: '20253', label: 'Automne 2025' },
    ];

    (termsHook.useTerms as unknown as Mock).mockReturnValue({
      terms,
      loading: false,
      error: null,
      fetchTerms: vi.fn(),
    });

    const view = renderPage();
    try {
      await view.render();
      const { firstDayOfClass, term } = useAddCourseFormStore.getState();

      expect(term).toBe('20252');
      expect(firstDayOfClass).toEqual(new Date(2025, 4, 1));
    } finally {
      await view.unmount();
    }
  });

  it('derives the first day of class from a zero-padded term id', async () => {
    const terms = [
      { id: '20251', label: 'Hiver 2025' },
      { id: '020252', label: 'Été 2025' },
      { id: '20253', label: 'Automne 2025' },
    ];

    (termsHook.useTerms as unknown as Mock).mockReturnValue({
      terms,
      loading: false,
      error: null,
      fetchTerms: vi.fn(),
    });

    const view = renderPage();
    try {
      await view.render();
      const { firstDayOfClass, term } = useAddCourseFormStore.getState();

      expect(term).toBe('020252');
      expect(firstDayOfClass).toEqual(new Date(2025, 4, 1));
    } finally {
      await view.unmount();
    }
  });

  it('renders term loading errors from the hook', async () => {
    (termsHook.useTerms as unknown as Mock).mockReturnValue({
      terms: [],
      loading: false,
      error: 'Failed to fetch terms',
      fetchTerms: vi.fn().mockResolvedValue([]),
    });

    const view = renderPage();
    try {
      await view.render();

      expect(view.container.textContent).toContain('Term Loading Failed');
      expect(view.container.textContent).toContain('Failed to fetch terms');
    } finally {
      await view.unmount();
    }
  });
});
