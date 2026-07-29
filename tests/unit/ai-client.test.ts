import { describe, expect, it, vi } from 'vitest';

const openAIMock = vi.fn();

vi.mock('openai', () => ({
  OpenAI: openAIMock,
}));

const { getAIClient } = await import('@/lib/ai/client');

describe('AI client', () => {
  it('disables SDK retries', () => {
    getAIClient({
      name: 'provider',
      apiKey: 'key',
      baseURL: 'https://provider',
      model: 'model',
    });

    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'key',
      baseURL: 'https://provider',
      maxRetries: 0,
    });
  });
});
