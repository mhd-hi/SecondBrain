import type { Task } from '@/types/task';
import type { Subtask } from '@/types/subtask';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubtaskActions } from '@/hooks/task/use-subtask-actions';
import { useTaskStore } from '@/lib/stores/task-store';
import { StatusTask } from '@/types/status-task';
import { renderHookHost } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

const createSubtaskApiMock = vi.fn();
const deleteSubtaskApiMock = vi.fn();
const updateSubtaskFieldHandlerMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock('@/hooks/task/use-subtask', () => ({
  createSubtask: (...args: unknown[]) => createSubtaskApiMock(...args),
  deleteSubtask: (...args: unknown[]) => deleteSubtaskApiMock(...args),
  useUpdateSubtaskField: vi.fn(() => updateSubtaskFieldHandlerMock),
}));

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  courseId: 'course-1',
  title: 'Parent task',
  notes: 'Parent notes',
  type: 'theorie',
  status: StatusTask.TODO,
  estimatedEffort: 2,
  actualEffort: 0,
  subtasks: [],
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

describe('useSubtaskActions', () => {
  beforeEach(() => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useTaskStore.getState().reset();
    useTaskStore.getState().setTasks([
      createTask({
        subtasks: [
          { id: 'subtask-1', title: 'Draft outline', notes: 'Initial notes' },
        ],
      }),
    ]);
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(console, 'warn').mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useTaskStore.getState().reset();
  });

  it('adds a created subtask to the store', async () => {
    const createdSubtask: Subtask = { id: 'subtask-2', title: 'Research', notes: 'Read papers' };
    createSubtaskApiMock.mockResolvedValue(createdSubtask);

    let actions!: ReturnType<typeof useSubtaskActions>;
    const view = renderHookHost(
      () => useSubtaskActions({ taskId: 'task-1', courseId: 'course-1' }),
      (value) => {
        actions = value;
      },
    );

    try {
      await view.render();

      await expect(
        actions.addSubtask({ title: 'Research', notes: 'Read papers' }),
      ).resolves.toEqual(createdSubtask);

      expect(useTaskStore.getState().getTask('task-1')?.subtasks).toContainEqual(createdSubtask);
    } finally {
      await view.unmount();
    }
  });

  it('returns null and does not mutate the store when addSubtask fails', async () => {
    createSubtaskApiMock.mockResolvedValue(null);

    let actions!: ReturnType<typeof useSubtaskActions>;
    const view = renderHookHost(
      () => useSubtaskActions({ taskId: 'task-1', courseId: 'course-1' }),
      (value) => {
        actions = value;
      },
    );

    try {
      await view.render();

      await expect(
        actions.addSubtask({ title: 'Failed', notes: 'No mutation' }),
      ).resolves.toBeNull();

      expect(useTaskStore.getState().getTask('task-1')?.subtasks).toEqual([
        { id: 'subtask-1', title: 'Draft outline', notes: 'Initial notes' },
      ]);
    } finally {
      await view.unmount();
    }
  });

  it('deletes a subtask from the store and toasts on success', async () => {
    deleteSubtaskApiMock.mockResolvedValue(true);

    let actions!: ReturnType<typeof useSubtaskActions>;
    const view = renderHookHost(
      () => useSubtaskActions({ taskId: 'task-1', courseId: 'course-1' }),
      (value) => {
        actions = value;
      },
    );

    try {
      await view.render();

      await actions.deleteSubtask('subtask-1');

      expect(useTaskStore.getState().getTask('task-1')?.subtasks).toEqual([]);
      expect(toastSuccessMock).toHaveBeenCalledWith('Subtask deleted');
    } finally {
      await view.unmount();
    }
  });

  it('aborts conversion when courseId is missing', async () => {
    const createTaskMock = vi.fn();
    useTaskStore.setState({ createTask: createTaskMock });

    let actions!: ReturnType<typeof useSubtaskActions>;
    const view = renderHookHost(
      () => useSubtaskActions({ taskId: 'task-1', courseId: null }),
      (value) => {
        actions = value;
      },
    );

    try {
      await view.render();

      await actions.convertSubtaskToTask({ id: 'subtask-1', title: 'Draft outline', notes: 'Initial notes' });

      expect(createTaskMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith('Cannot convert subtask to task: parent task has no course');
    } finally {
      await view.unmount();
    }
  });

  it('creates a task, deletes the subtask, and calls onTaskAdded on conversion success', async () => {
    const createTaskMock = vi.fn().mockResolvedValue(true);
    const onTaskAddedMock = vi.fn();
    deleteSubtaskApiMock.mockResolvedValue(true);
    useTaskStore.setState({ createTask: createTaskMock });

    let actions!: ReturnType<typeof useSubtaskActions>;
    const view = renderHookHost(
      () => useSubtaskActions({
        taskId: 'task-1',
        courseId: 'course-1',
        courseIdDueDate: new Date('2026-04-20T09:00:00.000Z'),
        onTaskAdded: onTaskAddedMock,
      }),
      (value) => {
        actions = value;
      },
    );

    try {
      await view.render();

      await actions.convertSubtaskToTask({ id: 'subtask-1', title: 'Draft outline', notes: 'Initial notes' });

      expect(createTaskMock).toHaveBeenCalledWith(
        'course-1',
        expect.objectContaining({
          title: 'Draft outline',
          notes: 'Initial notes',
          dueDate: new Date('2026-04-20T09:00:00.000Z'),
        }),
      );
      expect(deleteSubtaskApiMock).toHaveBeenCalledWith('task-1', 'subtask-1');
      expect(useTaskStore.getState().getTask('task-1')?.subtasks).toEqual([]);
      expect(onTaskAddedMock).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith('Subtask converted to task');
    } finally {
      await view.unmount();
    }
  });

  it('keeps the subtask when deletion fails after a successful conversion', async () => {
    const createTaskMock = vi.fn().mockResolvedValue(true);
    deleteSubtaskApiMock.mockResolvedValue(false);
    useTaskStore.setState({ createTask: createTaskMock });

    let actions!: ReturnType<typeof useSubtaskActions>;
    const view = renderHookHost(
      () => useSubtaskActions({
        taskId: 'task-1',
        courseId: 'course-1',
        courseIdDueDate: new Date('2026-04-20T09:00:00.000Z'),
      }),
      (value) => {
        actions = value;
      },
    );

    try {
      await view.render();

      await actions.convertSubtaskToTask({ id: 'subtask-1', title: 'Draft outline', notes: 'Initial notes' });

      expect(useTaskStore.getState().getTask('task-1')?.subtasks).toEqual([
        { id: 'subtask-1', title: 'Draft outline', notes: 'Initial notes' },
      ]);
      expect(toastSuccessMock).toHaveBeenCalledWith('Subtask converted to task (subtask not removed)');
    } finally {
      await view.unmount();
    }
  });
});
