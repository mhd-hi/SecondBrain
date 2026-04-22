import type { Task } from '@/types/task';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateTaskDueDate, updateTaskStatus, useUpdateTaskField } from '@/hooks/task/use-task';
import { useTaskStore } from '@/lib/stores/task-store';
import { StatusTask } from '@/types/status-task';
import { renderHookHost } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  courseId: 'course-1',
  title: 'Review lecture notes',
  notes: 'Chapter 4',
  type: 'theorie',
  status: StatusTask.TODO,
  estimatedEffort: 2,
  actualEffort: 0,
  subtasks: [],
  createdAt: new Date('2026-04-07T09:00:00.000Z'),
  updatedAt: new Date('2026-04-07T09:00:00.000Z'),
  dueDate: new Date('2026-04-10T09:00:00.000Z'),
  course: {
    id: 'course-1',
    code: 'LOG530',
    name: 'Reengineering',
    daypart: 'PM',
    color: 'blue',
  },
  ...overrides,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const originalFetch = globalThis.fetch;

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

describe('updateTaskStatus', () => {
  beforeEach(() => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useTaskStore.getState().reset();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    setFetchMock(originalFetch);
    vi.restoreAllMocks();
    useTaskStore.getState().reset();
  });

  it('updates the store immediately without flipping loading state', async () => {
    useTaskStore.getState().setTasks([createTask()]);

    const deferred = createDeferred<Response>();
    setFetchMock(vi.fn(() => deferred.promise) as unknown as typeof fetch);

    const updatePromise = updateTaskStatus('task-1', StatusTask.IN_PROGRESS);

    expect(useTaskStore.getState().getTask('task-1')?.status).toBe(StatusTask.IN_PROGRESS);
    expect(useTaskStore.getState().isLoading).toBe(false);

    deferred.resolve({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    await expect(updatePromise).resolves.toBe(true);
  });

  it('rolls back the optimistic status when the request fails', async () => {
    useTaskStore.getState().setTasks([createTask()]);

    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('status update failed'),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      updateTaskStatus('task-1', StatusTask.COMPLETED),
    ).rejects.toBeInstanceOf(Error);

    expect(useTaskStore.getState().getTask('task-1')?.status).toBe(StatusTask.TODO);
  });

  it('updates the due date immediately without flipping loading state', async () => {
    useTaskStore.getState().setTasks([createTask()]);

    const nextDueDate = new Date('2026-04-15T09:00:00.000Z');
    const deferred = createDeferred<Response>();
    setFetchMock(vi.fn(() => deferred.promise) as unknown as typeof fetch);

    const updatePromise = updateTaskDueDate('task-1', nextDueDate);

    expect(useTaskStore.getState().getTask('task-1')?.dueDate).toEqual(nextDueDate);
    expect(useTaskStore.getState().isLoading).toBe(false);

    deferred.resolve({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    await expect(updatePromise).resolves.toBe(true);
  });

  it('rolls back the optimistic due date when the request fails', async () => {
    const originalTask = createTask();
    useTaskStore.getState().setTasks([originalTask]);

    const nextDueDate = new Date('2026-04-15T09:00:00.000Z');

    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('due date update failed'),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      updateTaskDueDate('task-1', nextDueDate),
    ).rejects.toBeInstanceOf(Error);

    expect(useTaskStore.getState().getTask('task-1')?.dueDate).toEqual(originalTask.dueDate);
  });

  it('replaces only the fetched course slice and tracks status per course', async () => {
    const existingCourseOneTask = createTask({ id: 'task-course-1', courseId: 'course-1' });
    const staleCourseTwoTask = createTask({ id: 'stale-course-2', courseId: 'course-2' });
    const freshCourseTwoTask = createTask({ id: 'task-2', courseId: 'course-2' });
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue([freshCourseTwoTask]),
    } as unknown as Response;

    useTaskStore.getState().setTasks([existingCourseOneTask, staleCourseTwoTask]);
    setFetchMock(vi.fn().mockResolvedValue(response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().fetchTasksByCourse('course-2'),
    ).resolves.toEqual([freshCourseTwoTask]);

    expect(useTaskStore.getState().getTasksByCourse('course-1')).toEqual([existingCourseOneTask]);
    expect(useTaskStore.getState().getTasksByCourse('course-2')).toEqual([freshCourseTwoTask]);
    expect(useTaskStore.getState().getFetchStatusByCourse('course-2')).toBe('success');
    expect(useTaskStore.getState().getFetchStatusByCourse('course-1')).toBe('idle');
  });
});

describe('useUpdateTaskField', () => {
  beforeEach(() => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useTaskStore.getState().reset();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    setFetchMock(originalFetch);
    vi.restoreAllMocks();
    useTaskStore.getState().reset();
  });

  it('rolls back the optimistic field update when the request fails', async () => {
    useTaskStore.getState().setTasks([createTask()]);

    let updateTaskField!: ReturnType<typeof useUpdateTaskField>;
    const view = renderHookHost(useUpdateTaskField, hookValue => {
      updateTaskField = hookValue;
    });

    try {
      await view.render();

      setFetchMock(vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('task field update failed'),
      } as unknown as Response) as unknown as typeof fetch);

      const updatePromise = updateTaskField('task-1', 'title', 'Ship rollback fix');

      expect(useTaskStore.getState().getTask('task-1')?.title).toBe('Ship rollback fix');

      await expect(updatePromise).rejects.toBeInstanceOf(Error);
      expect(useTaskStore.getState().getTask('task-1')?.title).toBe('Review lecture notes');
    } finally {
      await view.unmount();
    }
  });
});
