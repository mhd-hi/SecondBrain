import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildChatProviderAttemptsMock = vi.fn();
const getAIClientMock = vi.fn();
const executeReadToolMock = vi.fn();

vi.mock('@/lib/ai/providers', () => ({
  buildChatProviderAttempts: buildChatProviderAttemptsMock,
}));
vi.mock('@/lib/ai/client', () => ({
  getAIClient: getAIClientMock,
}));
vi.mock('@/lib/ai/stats', () => ({
  aiErrorCode: () => 'TEST_ERROR',
  recordAIModelAttempt: vi.fn(),
}));
vi.mock('@/lib/ai/chat/tools', () => ({
  CHAT_READ_TOOLS: [],
  MAX_PLANNER_NOTES_CHARACTERS: 12_000,
  executeReadTool: executeReadToolMock,
}));

const { planTaskAction } = await import('@/lib/ai/chat/planner');

beforeEach(() => {
  (buildChatProviderAttemptsMock as unknown as Mock).mockReset();
  (getAIClientMock as unknown as Mock).mockReset();
  (executeReadToolMock as unknown as Mock).mockReset();
});

describe('AI chat planner fallback', () => {
  it('returns a valid no-tool response without making a second call', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              kind: 'clarification',
              message:
                'What should the task be called, which course is it for, and when is it due?',
              options: [{ label: 'Provide task details' }],
            }),
          },
        },
      ],
    });
    (buildChatProviderAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'google-ai-studio',
        model: 'gemini',
        apiKey: 'key',
        baseURL: 'url',
      },
    ]);
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create } },
    });

    await expect(
      planTaskAction({
        request: {
          requestId: crypto.randomUUID(),
          message: 'actualy can you add one task pls',
        },
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      kind: 'clarification',
      message:
        'What should the task be called, which course is it for, and when is it due?',
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('sends a clarification reply as the next real conversation turn', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"kind":"reply","message":"Ready"}',
          },
        },
      ],
    });
    (buildChatProviderAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'google-ai-studio',
        model: 'gemini',
        apiKey: 'key',
        baseURL: 'url',
      },
    ]);
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create } },
    });

    await planTaskAction({
      request: {
        requestId: crypto.randomUUID(),
        message: '2026-07-29',
        history: [
          {
            role: 'user',
            content: 'Create "Explication des exigences" for LOG710.',
          },
          {
            role: 'assistant',
            content: 'Please provide the due date.',
          },
        ],
      },
      userId: 'user-1',
    });

    expect(create.mock.calls[0]?.[0].messages.slice(-4, -1)).toEqual([
      {
        role: 'user',
        content: 'Create "Explication des exigences" for LOG710.',
      },
      { role: 'assistant', content: 'Please provide the due date.' },
      { role: 'user', content: '2026-07-29' },
    ]);
  });

  it('discards malformed planner output and uses the next provider', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: 'ready' } }] })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"kind":"draft"}' } }],
      })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'ready' } }] })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"kind":"reply","message":"Nothing to change"}',
            },
          },
        ],
      });
    (buildChatProviderAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'google-ai-studio',
        model: 'gemini',
        apiKey: 'key',
        baseURL: 'url',
      },
      { name: 'groq', model: 'groq', apiKey: 'key', baseURL: 'url' },
    ]);
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create } },
    });

    await expect(
      planTaskAction({
        request: {
          requestId: crypto.randomUUID(),
          message: 'What is due?',
        },
        userId: 'user-1',
      }),
    ).resolves.toEqual({ kind: 'reply', message: 'Nothing to change' });
    expect(create).toHaveBeenCalledTimes(4);
    expect(create.mock.calls[1]?.[0].messages.at(-1)).toEqual({
      role: 'user',
      content:
        'Return the final PlannerOutput JSON now. Tools are no longer available.',
    });
  });

  it('falls back after an unknown tool call', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: { name: 'write_task', arguments: '{}' },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'ready' } }] })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"kind":"reply","message":"Safe fallback"}',
            },
          },
        ],
      });
    (buildChatProviderAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'google-ai-studio',
        model: 'gemini',
        apiKey: 'key',
        baseURL: 'url',
      },
      { name: 'groq', model: 'groq', apiKey: 'key', baseURL: 'url' },
    ]);
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create } },
    });
    (executeReadToolMock as unknown as Mock).mockRejectedValue(
      new Error('Unknown tool'),
    );

    const result = await planTaskAction({
      request: {
        requestId: crypto.randomUUID(),
        message: 'Delete something',
      },
      userId: 'user-1',
    });

    expect(result).toEqual({ kind: 'reply', message: 'Safe fallback' });
  });
});
