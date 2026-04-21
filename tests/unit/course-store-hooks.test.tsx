import type { Course } from '@/types/course';
import type { Task } from '@/types/task';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourses } from '@/hooks/course/use-course-store';
import { getCourseListItemsFromCourses, useCourseStore } from '@/lib/stores/course-store';
import { api } from '@/lib/utils/api/api-client-util';
import { StatusTask } from '@/types/status-task';
import { ensureHappyDom, restoreSystemDate, setSystemDate } from '../helpers/runtime';

vi.mock('@/lib/utils/api/api-client-util', () => ({
  api: {
    get: vi.fn(),
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    courseId: 'course-1',
    title: 'Task',
    type: 'theorie',
    status: StatusTask.TODO,
    estimatedEffort: 2,
    actualEffort: 0,
    dueDate: new Date(2026, 3, 18),
    course: {} as Course,
    ...overrides,
  };
}

function createCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-1',
    code: 'LOG210',
    name: 'Software Construction',
    daypart: 'AM',
    color: 'blue',
    tasks: [],
    ...overrides,
  };
}

function renderCourseLoadingProbe() {
  const container = document.createElement('div');
  const root = createRoot(container);

  function CourseLoadingProbe() {
    const { isLoading } = useCourses();
    return <div>{isLoading ? 'loading' : 'ready'}</div>;
  }

  return {
    container,
    render: async () => {
      // We mount through ReactDOM directly in this test helper, so manual act is required.
      // eslint-disable-next-line testing-library/no-unnecessary-act
      await act(async () => {
        root.render(<CourseLoadingProbe />);
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
  setSystemDate(new Date(2026, 3, 20, 12));
  useCourseStore.getState().reset();
  useCourseStore.setState({ fetchStatus: 'success' });
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
  restoreSystemDate();
  vi.restoreAllMocks();
  useCourseStore.getState().reset();
});

describe('course list derivation', () => {
  it('computes overdue counts from real task data', () => {
    const courses = [
      createCourse({
        id: 'course-1',
        code: 'LOG210',
        tasks: [
          createTask({ id: 'task-overdue', courseId: 'course-1', dueDate: new Date(2026, 3, 18) }),
          createTask({ id: 'task-future', courseId: 'course-1', dueDate: new Date(2026, 3, 23) }),
          createTask({ id: 'task-completed', courseId: 'course-1', dueDate: new Date(2026, 3, 17), status: StatusTask.COMPLETED }),
        ],
      }),
      createCourse({
        id: 'course-2',
        code: 'MAT145',
        color: 'green',
        tasks: [
          createTask({ id: 'task-future-2', courseId: 'course-2', dueDate: new Date(2026, 3, 25) }),
        ],
      }),
    ];

    useCourseStore.getState().setCourses(courses);

    expect(useCourseStore.getState().getCoursesListItems()).toEqual([
      { id: 'course-1', code: 'LOG210', name: 'Software Construction', color: 'blue', overdueCount: 1 },
      { id: 'course-2', code: 'MAT145', name: 'Software Construction', color: 'green', overdueCount: 0 },
    ]);
  });

  it('keeps the shared derivation aligned with the store getter', () => {
    const courses = [
      createCourse({
        id: 'course-2',
        code: 'MAT145',
        color: 'green',
        tasks: [createTask({ id: 'task-2', courseId: 'course-2', dueDate: new Date(2026, 3, 25) })],
      }),
      createCourse({
        id: 'course-1',
        code: 'LOG210',
        tasks: [createTask({ id: 'task-1', courseId: 'course-1', dueDate: new Date(2026, 3, 18) })],
      }),
    ];

    useCourseStore.getState().setCourses(courses);

    const expected = getCourseListItemsFromCourses(courses);

    expect(useCourseStore.getState().getCoursesListItems()).toEqual(expected);
  });

  it('keeps the hook loading until the initial fetch succeeds', async () => {
    const deferred = createDeferred<Course[]>();
    const fetchedCourse = createCourse({ id: 'course-2', code: 'MAT145', color: 'green' });

    vi.mocked(api.get).mockReturnValueOnce(deferred.promise);
    useCourseStore.getState().reset();

    const view = renderCourseLoadingProbe();

    try {
      await view.render();

      expect(view.container.textContent).toBe('loading');

      let fetchPromise!: Promise<void>;

      await act(async () => {
        fetchPromise = useCourseStore.getState().fetchCourses();
      });

      expect(useCourseStore.getState().fetchStatus).toBe('loading');
      expect(view.container.textContent).toBe('loading');

      await act(async () => {
        deferred.resolve([fetchedCourse]);
        await fetchPromise;
      });

      expect(useCourseStore.getState().fetchStatus).toBe('success');
      expect(useCourseStore.getState().courses.get(fetchedCourse.id)).toEqual(fetchedCourse);
      expect(view.container.textContent).toBe('ready');
    } finally {
      await view.unmount();
    }
  });

  it('marks the course list fetch status as error and clears loading when the initial fetch fails', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network down'));
    useCourseStore.getState().reset();

    const view = renderCourseLoadingProbe();

    try {
      await view.render();

      await act(async () => {
        await useCourseStore.getState().fetchCourses();
      });

      expect(useCourseStore.getState().fetchStatus).toBe('error');
      expect(useCourseStore.getState().error).toBe('Failed to load courses');
      expect(view.container.textContent).toBe('ready');
    } finally {
      await view.unmount();
    }
  });
});
