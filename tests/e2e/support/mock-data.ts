import type { CourseApiResponse, CourseSummaryApiResponse } from '@/types/api/course';
import type { TCourseColor } from '@/types/colors';
import type { Daypart } from '@/types/course';
import type { StatusTask } from '@/types/status-task';
import { StatusTask as TaskStatus } from '@/types/status-task';
import type { TaskType } from '@/types/task';
import { TASK_TYPES } from '@/types/task';
import { createDeterministicIdFactory, MockClock } from './mock-seed';
import type { E2ETestUser } from './test-user';

type InternalSubtask = {
  id: string;
  title: string;
  notes?: string;
};

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
  subtasks: InternalSubtask[];
};

type UpdateCourseInput = Partial<Pick<InternalCourse, 'code' | 'name' | 'color' | 'daypart'>>;

type TaskUpdateInput = Partial<Pick<InternalTask, 'title' | 'notes' | 'type' | 'status' | 'estimatedEffort' | 'actualEffort' | 'dueDate'>> & {
  subtasks?: Array<Partial<InternalSubtask>>;
};

type TaskFieldInput = 'title' | 'notes' | 'status' | 'estimatedEffort' | 'actualEffort' | 'dueDate' | 'type';

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

  getCourseDetail(courseId: string): CourseApiResponse | null {
    const course = this.getCourseById(courseId);

    if (!course) {
      return null;
    }

    return {
      id: course.id,
      code: course.code,
      name: course.name,
      color: course.color,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      daypart: course.daypart,
      tasks: this.getTasksForCourse(courseId).map(task => ({
        id: task.id,
        courseId: task.courseId,
        title: task.title,
        notes: task.notes,
        dueDate: task.dueDate,
        type: task.type,
        status: task.status,
        estimatedEffort: task.estimatedEffort,
        actualEffort: task.actualEffort,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    };
  }

  getCourseSummaries() {
    return Array.from(this.courses.values())
      .map(course => this.buildCourseSummary(course))
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  getTasksForCourse(courseId: string) {
    return sortTasksByDueDate(Array.from(this.tasks.values()).filter(task => task.courseId === courseId));
  }

  getTaskById(taskId: string) {
    return this.tasks.get(taskId);
  }

  getTaskContainingSubtask(subtaskId: string) {
    return Array.from(this.tasks.values()).find(task => task.subtasks.some(subtask => subtask.id === subtaskId));
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

  updateCourse(courseId: string, updates: UpdateCourseInput) {
    const course = this.courses.get(courseId);

    if (!course) {
      return null;
    }

    if (updates.code !== undefined) {
      course.code = updates.code;
    }

    if (updates.name !== undefined) {
      course.name = updates.name;
    }

    if (updates.color !== undefined) {
      course.color = updates.color;
    }

    if (updates.daypart !== undefined) {
      course.daypart = updates.daypart;
    }

    course.updatedAt = this.clock.nextIso();

    return course;
  }

  deleteCourse(courseId: string) {
    const course = this.courses.get(courseId);

    if (!course) {
      return null;
    }

    this.courses.delete(courseId);

    for (const task of Array.from(this.tasks.values())) {
      if (task.courseId === courseId) {
        this.tasks.delete(task.id);
      }
    }

    return course;
  }

  createTasks(courseId: string, inputTasks: Array<{
    title: string;
    notes?: string;
    type: TaskType;
    status?: StatusTask;
    estimatedEffort: number;
    dueDate: string;
    subtasks?: Array<Partial<InternalSubtask>>;
  }>) {
    return inputTasks.map((task) => {
      const createdTask = this.createTask(courseId, task);

      if (!createdTask) {
        throw new Error(`Missing mock course for task ${task.title}.`);
      }

      return createdTask;
    });
  }

  createTask(courseId: string, task: {
    title: string;
    notes?: string;
    type: TaskType;
    status?: StatusTask;
    estimatedEffort?: number;
    actualEffort?: number;
    dueDate: string;
    subtasks?: Array<Partial<InternalSubtask>>;
  }) {
    const course = this.courses.get(courseId);

    if (!course) {
      return null;
    }

    const now = this.clock.nextIso();
    const createdTask: InternalTask = {
      id: this.createId('task'),
      courseId,
      title: task.title,
      notes: task.notes ?? '',
      type: task.type,
      status: task.status ?? TaskStatus.TODO,
      estimatedEffort: task.estimatedEffort ?? 1,
      actualEffort: task.actualEffort ?? 0,
      dueDate: task.dueDate,
      createdAt: now,
      updatedAt: now,
      subtasks: (task.subtasks ?? []).map(subtask => ({
        id: subtask.id ?? this.createId('subtask'),
        title: subtask.title ?? '',
        notes: subtask.notes ?? '',
      })),
    };

    this.tasks.set(createdTask.id, createdTask);

    return this.buildTaskResponse(createdTask);
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

  updateTaskField(taskId: string, input: TaskFieldInput, value: string | number | StatusTask) {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    switch (input) {
      case 'title':
        task.title = String(value);
        break;
      case 'notes':
        task.notes = String(value);
        break;
      case 'status':
        task.status = value as StatusTask;
        break;
      case 'estimatedEffort':
        task.estimatedEffort = Number(value);
        break;
      case 'actualEffort':
        task.actualEffort = Number(value);
        break;
      case 'dueDate':
        task.dueDate = this.normalizeDate(value) ?? task.dueDate;
        break;
      case 'type':
        task.type = value as TaskType;
        break;
    }

    task.updatedAt = this.clock.nextIso();

    return this.buildTaskResponse(task);
  }

  updateTask(taskId: string, updates: TaskUpdateInput) {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    if (updates.title !== undefined) {
      task.title = updates.title;
    }

    if (updates.notes !== undefined) {
      task.notes = updates.notes;
    }

    if (updates.type !== undefined) {
      task.type = updates.type;
    }

    if (updates.status !== undefined) {
      task.status = updates.status;
    }

    if (updates.estimatedEffort !== undefined) {
      task.estimatedEffort = updates.estimatedEffort;
    }

    if (updates.actualEffort !== undefined) {
      task.actualEffort = updates.actualEffort;
    }

    if (updates.dueDate !== undefined) {
      task.dueDate = this.normalizeDate(updates.dueDate) ?? task.dueDate;
    }

    if (Array.isArray(updates.subtasks)) {
      const nextSubtasks = new Map(task.subtasks.map(subtask => [subtask.id, subtask] as const));
      const providedIds = new Set<string>();

      for (const subtaskUpdate of updates.subtasks) {
        const subtaskId = subtaskUpdate.id ?? this.createId('subtask');
        providedIds.add(subtaskId);

        const existing = nextSubtasks.get(subtaskId);
        nextSubtasks.set(subtaskId, {
          id: subtaskId,
          title: subtaskUpdate.title ?? existing?.title ?? '',
          notes: subtaskUpdate.notes ?? existing?.notes ?? '',
        });
      }

      task.subtasks = Array.from(nextSubtasks.values()).filter(subtask => providedIds.has(subtask.id));
    }

    task.updatedAt = this.clock.nextIso();

    return this.buildTaskResponse(task);
  }

  deleteTask(taskId: string) {
    return this.tasks.delete(taskId);
  }

  createSubtask(taskId: string, input: { id?: string; title?: string; notes?: string }) {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    const subtask = {
      id: input.id ?? this.createId('subtask'),
      title: input.title ?? '',
      notes: input.notes ?? '',
    };

    task.subtasks = [...task.subtasks, subtask];
    task.updatedAt = this.clock.nextIso();

    return subtask;
  }

  updateSubtaskField(subtaskId: string, input: 'title' | 'notes', value: string) {
    const task = this.getTaskContainingSubtask(subtaskId);

    if (!task) {
      return null;
    }

    const index = task.subtasks.findIndex(subtask => subtask.id === subtaskId);

    if (index < 0) {
      return null;
    }

    const subtask = task.subtasks[index];

    if (!subtask) {
      return null;
    }

    subtask[input] = value;
    task.updatedAt = this.clock.nextIso();

    return subtask;
  }

  deleteSubtask(taskId: string, subtaskId: string) {
    const task = this.tasks.get(taskId);

    if (!task) {
      return false;
    }

    const nextSubtasks = task.subtasks.filter(subtask => subtask.id !== subtaskId);

    if (nextSubtasks.length === task.subtasks.length) {
      return false;
    }

    task.subtasks = nextSubtasks;
    task.updatedAt = this.clock.nextIso();

    return true;
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
      subtasks: task.subtasks.map(subtask => ({
        id: subtask.id,
        title: subtask.title,
        notes: subtask.notes,
      })),
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

  private normalizeDate(value: string | number | Date | null | undefined) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    return null;
  }
}
