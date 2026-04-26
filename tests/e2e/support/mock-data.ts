import type { CourseSummaryApiResponse } from '@/types/api/course';
import type { Daypart } from '@/types/course';
import type { StatusTask } from '@/types/status-task';
import type { TaskType } from '@/types/task';
import { StatusTask as TaskStatus } from '@/types/status-task';
import { TASK_TYPES } from '@/types/task';
import type { E2ETestUser } from './test-user';
import { createDeterministicIdFactory, MockClock } from './mock-seed';
import type { TCourseColor } from '@/types/colors';

export type InternalCourse = {
  id: string;
  code: string;
  name: string;
  color: TCourseColor;
  daypart: Daypart;
  term: string;
  createdAt: string;
  updatedAt: string;
};

export type InternalTask = {
  id: string;
  courseId: string;
  title: string;
  notes?: string;
  type: TaskType;
  status: StatusTask;
  estimatedEffort: number;
  actualEffort: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};

export const MOCK_TERMS = [
  { id: '20261', label: 'Hiver 2026' },
  { id: '20262', label: 'Été 2026' },
  { id: '20263', label: 'Automne 2026' },
] as const;

function sortTasksByDueDate(tasks: InternalTask[]) {
  return [...tasks].sort((left, right) =>
    new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
  );
}

function isUpcomingTaskType(type: TaskType) {
  return type === TASK_TYPES.EXAM || type === TASK_TYPES.HOMEWORK;
}

export class MockDataStore {
  readonly user: E2ETestUser;
  private readonly createId: (namespace: string) => string;
  private readonly clock = new MockClock();
  private readonly courses = new Map<string, InternalCourse>();
  private readonly tasks = new Map<string, InternalTask>();

  constructor({
    seed,
    user,
  }: {
    seed: string;
    user: E2ETestUser;
  }) {
    this.user = user;
    this.createId = createDeterministicIdFactory(seed);
  }

  getSessionExpiryIso(maxAgeSeconds: number) {
    return this.clock.sessionExpiresIso(maxAgeSeconds);
  }

  findCourseByCode(code: string) {
    return Array.from(this.courses.values()).find(course => course.code === code);
  }

  getCourseById(courseId: string) {
    return this.courses.get(courseId);
  }

  getCourseSummaries() {
    return Array.from(this.courses.values())
      .map(course => this.buildCourseSummary(course))
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  getTasksForCourse(courseId: string) {
    return sortTasksByDueDate(
      Array.from(this.tasks.values()).filter(task => task.courseId === courseId),
    );
  }

  createCourse({
    code,
    name,
    term,
    daypart,
  }: {
    code: string;
    name: string;
    term: string;
    daypart: Daypart;
  }) {
    const duplicate = Array.from(this.courses.values()).find(course =>
      course.code === code && course.term === term,
    );

    if (duplicate) {
      return { duplicate };
    }

    const now = this.clock.nextIso();
    const course: InternalCourse = {
      id: this.createId('course'),
      code,
      name,
      color: 'blue',
      daypart,
      term,
      createdAt: now,
      updatedAt: now,
    };

    this.courses.set(course.id, course);

    return { course };
  }

  createTasks(courseId: string, inputTasks: Array<{
    title: string;
    notes?: string;
    type: TaskType;
    status?: StatusTask;
    estimatedEffort: number;
    dueDate: string;
  }>) {
    return inputTasks.map((task) => {
      const now = this.clock.nextIso();
      const createdTask: InternalTask = {
        id: this.createId('task'),
        courseId,
        title: task.title,
        notes: task.notes ?? '',
        type: task.type,
        status: task.status ?? TaskStatus.TODO,
        estimatedEffort: task.estimatedEffort,
        actualEffort: 0,
        dueDate: task.dueDate,
        createdAt: now,
        updatedAt: now,
      };

      this.tasks.set(createdTask.id, createdTask);

      return this.buildTaskResponse(createdTask);
    });
  }

  updateTaskStatus(taskId: string, status: StatusTask) {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    task.status = status;
    task.updatedAt = this.clock.nextIso();

    return this.buildTaskResponse(task);
  }

  buildTaskResponse(task: InternalTask) {
    const course = this.courses.get(task.courseId);

    if (!course) {
      throw new Error(`Missing mock course for task ${task.id}.`);
    }

    return {
      id: task.id,
      courseId: task.courseId,
      title: task.title,
      notes: task.notes ?? '',
      type: task.type,
      status: task.status,
      estimatedEffort: task.estimatedEffort,
      actualEffort: task.actualEffort,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      course: {
        id: course.id,
        code: course.code,
        name: course.name,
        color: course.color,
        daypart: course.daypart,
      },
    };
  }

  private buildCourseSummary(course: InternalCourse): CourseSummaryApiResponse {
    const tasks = this.getTasksForCourse(course.id);
    const nextTask = tasks.find(task => task.status !== TaskStatus.COMPLETED) ?? null;
    const upcomingTask = tasks.find(task =>
      task.status !== TaskStatus.COMPLETED && isUpcomingTaskType(task.type),
    ) ?? null;

    return {
      id: course.id,
      code: course.code,
      name: course.name,
      color: course.color,
      daypart: course.daypart,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(task => task.status === TaskStatus.COMPLETED).length,
      inProgressTasks: tasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length,
      todoTasks: tasks.filter(task => task.status === TaskStatus.TODO).length,
      overdueCount: 0,
      dueSoonCount: 0,
      nextTask: nextTask
        ? {
          id: nextTask.id,
          title: nextTask.title,
          dueDate: nextTask.dueDate,
        }
        : null,
      upcomingTask: upcomingTask
        ? {
          id: upcomingTask.id,
          title: upcomingTask.title,
          dueDate: upcomingTask.dueDate,
        }
        : null,
    };
  }
}
