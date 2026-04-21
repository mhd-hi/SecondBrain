import type { Task } from '@/types/task';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@/lib/stores/task-store';
import { CommonErrorMessages } from '@/lib/utils/errors/error';
import { StatusTask } from '@/types/status-task';

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

describe('useTaskStore.updateTaskStatus', () => {
  beforeEach(() => {
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

    const updatePromise = useTaskStore.getState().updateTaskStatus('task-1', StatusTask.IN_PROGRESS);

    expect(useTaskStore.getState().getTask('task-1')?.status).toBe(StatusTask.IN_PROGRESS);
    expect(useTaskStore.getState().isLoading).toBe(false);

    deferred.resolve({ ok: true } as Response);

    await expect(updatePromise).resolves.toBe(true);
  });

  it('rolls back the optimistic status when the request fails', async () => {
    useTaskStore.getState().setTasks([createTask()]);

    setFetchMock(vi.fn().mockResolvedValue({ ok: false } as Response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().updateTaskStatus('task-1', StatusTask.COMPLETED),
    ).resolves.toBe(false);

    expect(useTaskStore.getState().getTask('task-1')?.status).toBe(StatusTask.TODO);
    expect(useTaskStore.getState().error).toBe(CommonErrorMessages.TASK_STATUS_UPDATE_FAILED);
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
