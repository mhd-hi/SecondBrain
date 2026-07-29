import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCoursePlanTasks } from '@/lib/ai/parse';

const buildProviderAttemptsMock = vi.fn();
const getAIClientMock = vi.fn();

vi.mock('@/lib/ai/providers', () => ({
  buildProviderAttempts: buildProviderAttemptsMock,
}));

vi.mock('@/lib/ai/client', () => ({
  getAIClient: getAIClientMock,
}));

const { callWithFallback } = await import('@/lib/ai/call');

beforeEach(() => {
  (buildProviderAttemptsMock as unknown as Mock).mockReset();
  (getAIClientMock as unknown as Mock).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockAbortSignalTimeout() {
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(
      () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
      milliseconds,
    );
    return controller.signal;
  });
}

describe('callWithFallback', () => {
  it('accepts a valid course plan wrapped in provider markdown', () => {
    expect(
      parseCoursePlanTasks(
        '```json\n[{"week":1,"type":"theorie","title":"Task","estimatedEffort":1}]\n```',
      ),
    ).toHaveLength(1);
  });

  it('tries later models when earlier attempts fail', async () => {
    const groqCreate = vi.fn().mockRejectedValue(new Error('rate limited'));
    const nvidiaCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('model unavailable'))
      .mockResolvedValueOnce({
        model: 'nvidia-model-2',
        usage: { total_tokens: 42 },
        choices: [
          { finish_reason: 'stop', message: { content: '[{"title":"Task"}]' } },
        ],
      });

    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'groq',
        apiKey: 'groq-key',
        baseURL: 'https://groq',
        model: 'groq-model-1',
      },
      {
        name: 'nvidia',
        apiKey: 'nvidia-key',
        baseURL: 'https://nvidia',
        model: 'nvidia-model-1',
      },
      {
        name: 'nvidia',
        apiKey: 'nvidia-key',
        baseURL: 'https://nvidia',
        model: 'nvidia-model-2',
      },
    ]);

    (getAIClientMock as unknown as Mock).mockImplementation(
      (provider: { name: string }) => {
        if (provider.name === 'groq') {
          return { chat: { completions: { create: groqCreate } } };
        }

        return { chat: { completions: { create: nvidiaCreate } } };
      },
    );

    const result = await callWithFallback([
      { role: 'system', content: 'system' },
      { role: 'user', content: 'user' },
    ]);

    expect(result).toMatchObject({
      text: '[{"title":"Task"}]',
      model: 'nvidia-model-2',
    });
    expect(groqCreate).toHaveBeenCalledTimes(1);
    expect(nvidiaCreate).toHaveBeenCalledTimes(2);
    expect(nvidiaCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: 'nvidia-model-1' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(nvidiaCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: 'nvidia-model-2' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('throws a clear error when no providers are configured', async () => {
    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue([]);

    await expect(
      callWithFallback([
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
      ]),
    ).rejects.toMatchObject({ code: 'AI_PROVIDERS_EXHAUSTED' });
  });

  it('falls back when course-plan output is invalid', async () => {
    const invalidResponses = [
      'not json',
      '{"tasks":[]}',
      '[{}]',
      '[]',
      '[{"week":1,"type":"invalid","title":"Task","estimatedEffort":1}]',
      '[{"week":1,"type":"theorie","title":"Task","estimatedEffort":0.4}]',
      '[{"week":1,"type":"theorie","title":"Task","estimatedEffort":1,"extra":true}]',
    ];
    const validResponse =
      '[{"week":1,"type":"theorie","title":"Task","estimatedEffort":1}]';
    const create = vi.fn();

    for (const response of [...invalidResponses, validResponse]) {
      create.mockResolvedValueOnce({
        model: 'model',
        choices: [{ finish_reason: 'stop', message: { content: response } }],
      });
    }

    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue(
      [...invalidResponses, validResponse].map((_, index) => ({
        name: 'provider',
        apiKey: 'key',
        baseURL: 'https://provider',
        model: `model-${index}`,
      })),
    );
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create } },
    });

    const result = await callWithFallback(
      [{ role: 'user', content: 'prompt' }],
      { validate: parseCoursePlanTasks },
    );

    expect(result.text).toBe(validResponse);
    expect(create).toHaveBeenCalledTimes(invalidResponses.length + 1);
  });

  it('aborts an expired attempt and tries the next provider', async () => {
    vi.useFakeTimers();
    mockAbortSignalTimeout();
    const slowCreate = vi.fn(
      (_params, { signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
    );
    const fastCreate = vi.fn().mockResolvedValue({
      model: 'fast',
      choices: [{ finish_reason: 'stop', message: { content: 'ok' } }],
    });
    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue([
      { name: 'slow', apiKey: 'key', baseURL: 'https://slow', model: 'slow' },
      { name: 'fast', apiKey: 'key', baseURL: 'https://fast', model: 'fast' },
    ]);
    (getAIClientMock as unknown as Mock)
      .mockReturnValueOnce({ chat: { completions: { create: slowCreate } } })
      .mockReturnValueOnce({ chat: { completions: { create: fastCreate } } });

    const resultPromise = callWithFallback([
      { role: 'user', content: 'prompt' },
    ]);
    await vi.advanceTimersByTimeAsync(20_001);

    await expect(resultPromise).resolves.toMatchObject({ text: 'ok' });
    expect(fastCreate).toHaveBeenCalledOnce();
  });

  it('stops at the overall deadline without starting another attempt', async () => {
    vi.useFakeTimers();
    mockAbortSignalTimeout();
    const create = vi.fn(
      (_params, { signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
    );
    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue(
      Array.from({ length: 4 }, (_, index) => ({
        name: `provider-${index}`,
        apiKey: 'key',
        baseURL: 'https://provider',
        model: `model-${index}`,
      })),
    );
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create } },
    });

    const resultPromise = callWithFallback([
      { role: 'user', content: 'prompt' },
    ]);
    const rejection = expect(resultPromise).rejects.toMatchObject({
      code: 'AI_DEADLINE_EXCEEDED',
    });
    await vi.advanceTimersByTimeAsync(60_001);

    await rejection;
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('stops immediately after caller cancellation', async () => {
    const controller = new AbortController();
    const create = vi.fn(
      (_params, { signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
    );
    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'first',
        apiKey: 'key',
        baseURL: 'https://first',
        model: 'first',
      },
      {
        name: 'second',
        apiKey: 'key',
        baseURL: 'https://second',
        model: 'second',
      },
    ]);
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create } },
    });

    const resultPromise = callWithFallback(
      [{ role: 'user', content: 'prompt' }],
      { signal: controller.signal },
    );
    controller.abort();

    await expect(resultPromise).rejects.toMatchObject({ code: 'AI_ABORTED' });
    expect(create).toHaveBeenCalledOnce();
  });

  it('preserves cancellation when no providers are configured', async () => {
    const controller = new AbortController();
    controller.abort();
    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue([]);

    await expect(
      callWithFallback([{ role: 'user', content: 'prompt' }], {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'AI_ABORTED' });
  });
});
