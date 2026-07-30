import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIChatAssistant } from '@/components/AIChat/AIChatAssistant';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { StatusTask } from '@/types/status-task';
import type { Task } from '@/types/task';
import { renderComponent } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

function button(container: ParentNode, label: string) {
  return container.querySelector(
    `[aria-label="${label}"]`,
  ) as HTMLButtonElement;
}

function buttonWithText(container: ParentNode, text: string) {
  return Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent === text,
  ) as HTMLButtonElement;
}

const pendingDraft = {
  id: 'draft-1',
  requestId: 'request-1',
  status: 'pending',
  summary: 'Add one task',
  reason: 'Requested by the user',
  reviewPayload: {
    counts: { adds: 1, updates: 0, deletes: 0 },
    items: [],
  },
  failureCode: null,
  createdAt: '2026-07-29T00:00:00.000Z',
  expiresAt: '2026-07-30T00:00:00.000Z',
};

const task = {
  id: 'task-1',
  courseId: '22222222-2222-4222-8222-222222222222',
  title: 'Read chapter 1',
  type: 'theorie',
  status: StatusTask.TODO,
  estimatedEffort: 3,
  actualEffort: 0,
  dueDate: new Date('2026-09-08T12:00:00.000Z'),
  course: {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'LOG210',
    name: 'Software Construction',
    daypart: 'AM',
    color: 'blue',
  },
} satisfies Task;

function storeDraftConversation() {
  localStorage.setItem(
    'second-brain-ai-conversations-v1',
    JSON.stringify({
      activeConversationId: 'conversation-1',
      conversations: [
        {
          id: 'conversation-1',
          title: 'Add task',
          messages: [
            {
              id: 'message-1',
              role: 'assistant',
              text: 'I prepared changes for your review.',
              draftId: pendingDraft.id,
            },
          ],
        },
      ],
    }),
  );
}

describe('AIChatAssistant', () => {
  beforeEach(() => {
    ensureHappyDom();
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    useTaskStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useTaskStore.getState().reset();
    document.body.innerHTML = '';
  });

  it('opens as a full-screen mobile panel and docked desktop sidebar', async () => {
    const view = renderComponent(<AIChatAssistant />);
    await view.render();

    try {
      await act(async () => button(view.container, 'Open Lucy').click());

      const sidebar = view.container.querySelector(
        'aside[aria-label="Lucy task assistant"]',
      );

      expect(sidebar?.className).toContain('fixed');
      expect(sidebar?.className).toContain('h-dvh');
      expect(sidebar?.className).toContain('overflow-hidden');
      expect(sidebar?.className).toContain('md:sticky');
      expect(sidebar?.className).toContain('md:w-[var(--chat-width)]');
      expect(view.container.querySelector('[role="dialog"]')).toBeNull();

      await act(async () =>
        buttonWithText(view.container, 'About Lucy & privacy').click(),
      );

      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        'AI provider privacy notice',
      );

      await act(async () => buttonWithText(document, 'Close').click());

      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(
        view.container.querySelector('[data-radix-scroll-area-viewport]')
          ?.className,
      ).toContain('h-full');

      const resizeHandle = view.container.querySelector(
        '[aria-label="Resize Lucy"]',
      ) as HTMLDivElement;

      expect(resizeHandle.className).toContain('hidden');
      expect(resizeHandle.className).toContain('md:flex');

      await act(async () => {
        resizeHandle.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            bubbles: true,
          }),
        );
      });

      expect(sidebar?.getAttribute('style')).toContain('--chat-width: 408px');
    } finally {
      await view.unmount();
    }
  });

  it('switches between saved conversations and restores their messages', async () => {
    localStorage.setItem(
      'second-brain-ai-conversations-v1',
      JSON.stringify({
        activeConversationId: 'conversation-1',
        conversations: [
          {
            id: 'conversation-1',
            title: 'LOG710 task',
            messages: [
              { id: 'message-1', role: 'user', text: 'First conversation' },
            ],
          },
          {
            id: 'conversation-2',
            title: 'LOG410 task',
            messages: [
              { id: 'message-2', role: 'user', text: 'Second conversation' },
            ],
          },
        ],
      }),
    );
    const view = renderComponent(<AIChatAssistant />);
    await view.render();

    try {
      await act(async () => button(view.container, 'Open Lucy').click());

      expect(view.container.textContent).toContain('First conversation');

      await act(async () => {
        button(view.container, 'Conversation history').dispatchEvent(
          new window.PointerEvent('pointerdown', {
            bubbles: true,
            button: 0,
          }),
        );
      });
      const conversation = Array.from(
        document.querySelectorAll('[role="menuitemradio"]'),
      ).find((item) => item.textContent === 'LOG410 task') as HTMLElement;
      await act(async () => {
        conversation.click();
      });

      const visibleMessages = Array.from(
        view.container.querySelectorAll('.whitespace-pre-wrap'),
        (element) => element.textContent,
      );

      expect(visibleMessages).toEqual(['Second conversation']);
    } finally {
      await view.unmount();
    }
  });

  it('marks an approved draft and records success in the conversation', async () => {
    storeDraftConversation();
    useTaskStore.getState().setTasks([{ ...task, id: 'deleted-task' }]);
    const refreshVersion =
      useCalendarViewStore.getState().refreshVersion;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(pendingDraft))
        .mockResolvedValueOnce(
          Response.json({
            draft: {
              ...pendingDraft,
              status: 'executed',
              reviewPayload: {
                ...pendingDraft.reviewPayload,
                items: [
                  {
                    type: 'delete',
                    taskId: 'deleted-task',
                    courseId: task.courseId,
                    title: 'Old task',
                    before: {},
                    diff: {},
                    warnings: [],
                    riskLevel: 'high',
                  },
                ],
              },
            },
            tasks: [task],
          }),
        ),
    );
    const view = renderComponent(<AIChatAssistant />);
    await view.render();

    try {
      await act(async () => button(view.container, 'Open Lucy').click());
      await act(async () => {
        buttonWithText(view.container, 'Review changes').click();
        await Promise.resolve();
      });
      await act(async () => {
        buttonWithText(document, 'Approve all changes').click();
        await Promise.resolve();
      });

      expect(view.container.textContent).toContain('✓ Applied');
      expect(view.container.textContent).not.toContain('Changes applied.');
      expect(
        buttonWithText(view.container, 'Review changes'),
      ).toBeDefined();
      expect(useTaskStore.getState().getTask(task.id)).toEqual({
        ...task,
        dueDate: task.dueDate.toISOString(),
      });
      expect(useTaskStore.getState().getTask('deleted-task')).toBeUndefined();
      expect(useCalendarViewStore.getState().refreshVersion).toBe(
        refreshVersion + 1,
      );
    } finally {
      await view.unmount();
    }
  });

  it('disables conversation changes while a request is running', async () => {
    storeDraftConversation();
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const view = renderComponent(<AIChatAssistant />);
    await view.render();

    try {
      await act(async () => button(view.container, 'Open Lucy').click());
      await act(async () => {
        buttonWithText(view.container, 'Review changes').click();
        await Promise.resolve();
      });

      expect(button(view.container, 'Conversation history').disabled).toBe(
        true,
      );
      expect(button(view.container, 'New conversation').disabled).toBe(true);

      await act(async () => {
        resolveFetch(Response.json(pendingDraft));
        await Promise.resolve();
      });
    } finally {
      await view.unmount();
    }
  });

  it('keeps the review available and records an approval failure', async () => {
    storeDraftConversation();
    useTaskStore.getState().setTasks([
      {
        ...task,
        title: 'Stale title',
      },
    ]);
    const staleDraft = {
      ...pendingDraft,
      status: 'stale',
      reviewPayload: {
        ...pendingDraft.reviewPayload,
        items: [
          {
            type: 'update',
            taskId: task.id,
            courseId: task.courseId,
            title: task.title,
            before: {},
            after: {},
            diff: {},
            warnings: [],
            riskLevel: 'medium',
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(pendingDraft))
        .mockResolvedValueOnce(
          Response.json(
            {
              message: 'Tasks changed since this draft was created',
              draft: staleDraft,
              tasks: [task],
            },
            { status: 409 },
          ),
        ),
    );
    const view = renderComponent(<AIChatAssistant />);
    await view.render();

    try {
      await act(async () => button(view.container, 'Open Lucy').click());
      await act(async () => {
        buttonWithText(view.container, 'Review changes').click();
        await Promise.resolve();
      });
      await act(async () => {
        buttonWithText(document, 'Approve all changes').click();
        await Promise.resolve();
      });

      expect(view.container.textContent).toContain(
        'Changes didn’t apply correctly. Please try again.',
      );
      expect(buttonWithText(view.container, 'Review changes').disabled).toBe(
        false,
      );
      expect(useTaskStore.getState().getTask(task.id)?.title).toBe(task.title);
    } finally {
      await view.unmount();
    }
  });
});
