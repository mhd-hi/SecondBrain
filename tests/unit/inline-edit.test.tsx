import type { Task } from '@/types/task';
import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditableField } from '@/components/shared/EditableField';
import { useSubtaskActions } from '@/hooks/task/use-subtask-actions';
import { useTaskCard } from '@/hooks/task/use-task-card';
import { useTaskStore } from '@/lib/stores/task-store';
import { StatusTask } from '@/types/status-task';
import { renderComponent, renderHookHost } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

const toastErrorMock = vi.fn();
const originalFetch = globalThis.fetch;

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

function createTask(overrides: Partial<Task> = {}): Task {
  return {
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
  };
}

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

async function click(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
  });
}

async function changeInputValue(input: HTMLInputElement, value: string) {
  const setValue
    = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
      ?? Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

  await act(async () => {
    if (setValue) {
      setValue.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

async function blurInput(input: HTMLInputElement) {
  await act(async () => {
    input.focus();
    input.blur();
    await Promise.resolve();
  });
}

async function flushTimers() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  ensureHappyDom();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  setFetchMock(originalFetch);
  useTaskStore.getState().reset();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
  setFetchMock(originalFetch);
  vi.restoreAllMocks();
  useTaskStore.getState().reset();
});

describe('EditableField', () => {
  it('keeps editing open when an async save rejects without leaking an unhandled rejection', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    const unhandledRejectionMock = vi.fn((event: PromiseRejectionEvent) => {
      event.preventDefault();
    });

    window.addEventListener('unhandledrejection', unhandledRejectionMock);

    const view = renderComponent(<EditableField value="Original title" onSave={onSave} />);

    try {
      await view.render();

      const button = document.body.getElementsByTagName('button').item(0);

      expect(button).not.toBeNull();

      await click(button!);

      const input = document.body.getElementsByTagName('input').item(0) as HTMLInputElement | null;

      expect(input).not.toBeNull();

      await flushTimers();
      await changeInputValue(input!, 'Updated title');
      await flushTimers();
      await blurInput(input!);
      await flushTimers();

      expect(onSave).toHaveBeenCalledWith('Updated title');
      expect(unhandledRejectionMock).not.toHaveBeenCalled();
      expect(document.body.getElementsByTagName('input').item(0)).not.toBeNull();
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejectionMock);
      await view.unmount();
    }
  });
});

describe('inline save toasts', () => {
  it('shows a task error toast when an inline task save fails', async () => {
    useTaskStore.getState().setTasks([createTask()]);
    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('task save failed'),
    } as unknown as Response) as unknown as typeof fetch);

    let taskCard!: ReturnType<typeof useTaskCard>;
    const view = renderHookHost(() => useTaskCard(createTask()), (hookValue) => {
      taskCard = hookValue;
    });

    try {
      await view.render();

      await expect(taskCard.saveTitle('Updated title')).rejects.toBeInstanceOf(Error);
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to update task');
    } finally {
      await view.unmount();
    }
  });

  it('shows a subtask error toast when an inline subtask save fails', async () => {
    useTaskStore.getState().setTasks([
      createTask({
        subtasks: [{ id: 'subtask-1', title: 'Draft outline', notes: 'Initial notes' }],
      }),
    ]);
    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('subtask save failed'),
    } as unknown as Response) as unknown as typeof fetch);

    let subtaskActions!: ReturnType<typeof useSubtaskActions>;
    const view = renderHookHost(() => useSubtaskActions({ taskId: 'task-1' }), (hookValue) => {
      subtaskActions = hookValue;
    });

    try {
      await view.render();

      await expect(subtaskActions.saveSubtaskTitle('subtask-1', 'Updated subtask')).rejects.toBeInstanceOf(Error);
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to update subtask');
    } finally {
      await view.unmount();
    }
  });
});
