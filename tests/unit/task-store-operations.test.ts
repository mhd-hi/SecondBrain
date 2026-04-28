import type { Task } from '@/types/task';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@/lib/stores/task-store';
import { StatusTask } from '@/types/status-task';
import { ensureHappyDom } from '../helpers/runtime';

const invalidateCalendarEventsMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock('@/lib/stores/calendar-view-store', () => ({
  invalidateCalendarEvents: () => invalidateCalendarEventsMock(),
}));

const originalFetch = globalThis.fetch;

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

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

describe('task store operations', () => {
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

  it('fetchTask adds the fetched task to the store', async () => {
    const fetchedTask = createTask({ id: 'task-2' });
    setFetchMock(vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(fetchedTask),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().fetchTask('task-2'),
    ).resolves.toEqual(fetchedTask);

    expect(useTaskStore.getState().getTask('task-2')).toEqual(fetchedTask);
    expect(useTaskStore.getState().isLoading).toBe(false);
  });

  it('fetchTask stores the error and clears loading state on failure', async () => {
    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('missing task'),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().fetchTask('missing-task'),
    ).resolves.toBeNull();

    expect(useTaskStore.getState().error).toBe('API request failed: 404 Not Found. missing task');
    expect(useTaskStore.getState().isLoading).toBe(false);
  });

  it('createTask appends the created task to the store on success', async () => {
    const createdTask = createTask({ id: 'task-created' });
    setFetchMock(vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([createdTask]),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().createTask('course-1', {
        title: 'Created task',
        notes: 'Notes',
        estimatedEffort: 1,
        dueDate: new Date('2026-04-12T09:00:00.000Z'),
        type: 'homework',
        status: StatusTask.TODO,
      }),
    ).resolves.toBe(true);

    expect(useTaskStore.getState().getTask('task-created')).toEqual(createdTask);
    expect(invalidateCalendarEventsMock).toHaveBeenCalled();
  });

  it('createTask leaves tasks unchanged and stores an error on failure', async () => {
    const existingTask = createTask();
    useTaskStore.getState().setTasks([existingTask]);
    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('create failed'),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().createTask('course-1', {
        title: 'Created task',
        notes: 'Notes',
        estimatedEffort: 1,
        dueDate: new Date('2026-04-12T09:00:00.000Z'),
        type: 'homework',
        status: StatusTask.TODO,
      }),
    ).resolves.toBe(false);

    expect(useTaskStore.getState().getAllTasks()).toEqual([existingTask]);
    expect(useTaskStore.getState().error).toBe('Failed to add task');
  });

  it('removeTask deletes the task from the store and toasts on success', async () => {
    const existingTask = createTask();
    useTaskStore.getState().setTasks([existingTask]);
    setFetchMock(vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().removeTask('task-1'),
    ).resolves.toBe(true);

    expect(useTaskStore.getState().getTask('task-1')).toBeUndefined();
    expect(toastSuccessMock).toHaveBeenCalledWith('Task deleted successfully');
  });

  it('removeTask keeps the task in the store and records an error on failure', async () => {
    const existingTask = createTask();
    useTaskStore.getState().setTasks([existingTask]);
    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('delete failed'),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      useTaskStore.getState().removeTask('task-1'),
    ).resolves.toBe(false);

    expect(useTaskStore.getState().getTask('task-1')).toEqual(existingTask);
    expect(useTaskStore.getState().error).toBe('Failed to delete task');
  });
});
