import type { Task } from '@/types/task';
import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KanbanBoard } from '@/components/Kanban/KanbanBoard';
import { useTaskStore } from '@/lib/stores/task-store';
import { StatusTask } from '@/types/status-task';
import { renderComponent } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

const getTasksMock = vi.fn();

vi.mock('react-dnd', () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/utils/api/api-client-util', () => ({
  api: {
    get: (...args: unknown[]) => getTasksMock(...args),
  },
}));

vi.mock('@/components/Kanban/KanbanColumn', () => ({
  KanbanColumn: ({ status, tasks }: { status: StatusTask; tasks: Task[] }) => (
    <ol data-status={status}>
      {tasks.map(task => <li key={task.id}>{task.title}</li>)}
    </ol>
  ),
}));

function task(id: string, title: string, dueDate: string): Task {
  return {
    id,
    courseId: 'course-1',
    title,
    type: 'homework',
    status: StatusTask.TODO,
    estimatedEffort: 1,
    actualEffort: 0,
    dueDate: new Date(dueDate),
    course: {
      id: 'course-1',
      code: 'LOG100',
      name: 'Course',
      color: 'blue',
      daypart: 'AM',
    },
  };
}

function todoTitles(container: ParentNode) {
  return Array.from(container.querySelectorAll(`[data-status="${StatusTask.TODO}"] li`))
    .map(element => element.textContent);
}

async function changeInput(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  ensureHappyDom();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  useTaskStore.getState().reset();
  getTasksMock.mockResolvedValue([
    task('later', 'Write report', '2026-09-20T12:00:00.000Z'),
    task('earlier', 'Review notes', '2026-09-10T12:00:00.000Z'),
  ]);
});

afterEach(() => {
  useTaskStore.getState().reset();
  vi.clearAllMocks();
});

describe('KanbanBoard', () => {
  it('filters task titles and changes the due-date sort direction', async () => {
    const view = renderComponent(<KanbanBoard />);

    try {
      await view.render();
      await act(async () => Promise.resolve());

      expect(todoTitles(view.container)).toEqual(['Review notes', 'Write report']);

      const input = view.container.querySelector<HTMLInputElement>('input[aria-label="Filter tasks by keyword"]');

      expect(input).not.toBeNull();

      await changeInput(input!, 'write');

      expect(todoTitles(view.container)).toEqual(['Write report']);

      await changeInput(input!, '');
      await act(async () => {
        view.container.querySelector<HTMLButtonElement>('button')!.dispatchEvent(
          new window.PointerEvent('pointerdown', { bubbles: true, button: 0 }),
        );
      });
      const latestFirst = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
        .find(item => item.textContent?.includes('latest first'));

      expect(latestFirst).toBeDefined();

      await act(async () => latestFirst!.click());

      expect(todoTitles(view.container)).toEqual(['Write report', 'Review notes']);
    } finally {
      await view.unmount();
    }
  });
});
