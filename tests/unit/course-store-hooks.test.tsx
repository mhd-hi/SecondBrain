import type { Course } from '@/types/course';
import type { Task } from '@/types/task';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCourseListItemsFromCourses, useCourseStore } from '@/lib/stores/course-store';
import { StatusTask } from '@/types/status-task';
import { restoreSystemDate, setSystemDate } from '../helpers/runtime';

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

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setSystemDate(new Date(2026, 3, 20, 12));
  useCourseStore.getState().reset();
  useCourseStore.setState({ hasInitialized: true });
});

afterEach(() => {
  restoreSystemDate();
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
});
