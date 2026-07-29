import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIChatAssistant } from '@/components/AIChat/AIChatAssistant';
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      expect(
        view.container.querySelector('a[href="/privacy/ai"]')?.textContent,
      ).toContain('About Lucy & privacy');
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
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(pendingDraft))
        .mockResolvedValueOnce(
          Response.json({
            draft: { ...pendingDraft, status: 'executed' },
            tasks: [],
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

      expect(view.container.textContent).toContain('Changes applied.');
      expect(buttonWithText(view.container, 'Changes applied').disabled).toBe(
        true,
      );
    } finally {
      await view.unmount();
    }
  });

  it('keeps the review available and records an approval failure', async () => {
    storeDraftConversation();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(pendingDraft))
        .mockResolvedValueOnce(
          Response.json(
            { message: 'Draft cannot be approved', draft: pendingDraft },
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
    } finally {
      await view.unmount();
    }
  });
});
