import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('callWithFallback', () => {
  it('tries later models when earlier attempts fail', async () => {
    const groqCreate = vi.fn().mockRejectedValue(new Error('rate limited'));
    const nvidiaCreate = vi.fn()
      .mockRejectedValueOnce(new Error('model unavailable'))
      .mockResolvedValueOnce({
        model: 'nvidia-model-2',
        usage: { total_tokens: 42 },
        choices: [{ finish_reason: 'stop', message: { content: '[{"title":"Task"}]' } }],
      });

    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue([
      { name: 'groq', apiKey: 'groq-key', baseURL: 'https://groq', model: 'groq-model-1' },
      { name: 'nvidia', apiKey: 'nvidia-key', baseURL: 'https://nvidia', model: 'nvidia-model-1' },
      { name: 'nvidia', apiKey: 'nvidia-key', baseURL: 'https://nvidia', model: 'nvidia-model-2' },
    ]);

    (getAIClientMock as unknown as Mock).mockImplementation((provider: { name: string }) => {
      if (provider.name === 'groq') {
        return { chat: { completions: { create: groqCreate } } };
      }

      return { chat: { completions: { create: nvidiaCreate } } };
    });

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
    expect(nvidiaCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'nvidia-model-1' }));
    expect(nvidiaCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'nvidia-model-2' }));
  });

  it('throws a clear error when no providers are configured', async () => {
    (buildProviderAttemptsMock as unknown as Mock).mockReturnValue([]);

    await expect(callWithFallback([
      { role: 'system', content: 'system' },
      { role: 'user', content: 'user' },
    ])).rejects.toThrow('All AI providers failed or are unconfigured');
  });
});
