import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  env: {
    BAI_API_KEY: 'bai',
    GROQ_API_KEY: 'groq',
    GOOGLE_AI_STUDIO_API_KEY: 'google',
    NVIDIA_API_KEY: 'nvidia',
    OPENROUTER_API_KEY: 'openrouter',
    XAI_API_KEY: 'xai',
  },
}));

const {
  buildChatProviderAttempts,
  buildProviderAttempts,
  buildProviderHealthAttempts,
} = await import('@/lib/ai/providers');

describe('AI provider configuration', () => {
  it('uses the configured provider and model order', () => {
    expect(
      buildProviderAttempts().map(({ name, model }) => [name, model]),
    ).toEqual([
      ['bai', 'glm-5.3-flash'],
      ['groq', 'openai/gpt-oss-120b'],
      ['google-ai-studio', 'gemini-3.5-flash'],
      ['google-ai-studio', 'gemini-3.5-flash-lite'],
      ['nvidia', 'meta/llama-3.3-70b-instruct'],
      ['nvidia', 'nvidia/nemotron-3-super-120b-a12b'],
      ['openrouter', 'nvidia/nemotron-3-super-120b-a12b:free'],
      ['openrouter', 'openai/gpt-oss-20b:free'],
      ['openrouter', 'openrouter/free'],
      ['xai', 'grok-4.5'],
    ]);
  });

  it('uses the separate chat provider and model order', () => {
    expect(
      buildChatProviderAttempts().map(({ name, model }) => [name, model]),
    ).toEqual([
      ['bai', 'glm-5.3-flash'],
      ['google-ai-studio', 'gemini-3.5-flash'],
      ['google-ai-studio', 'gemini-3.5-flash-lite'],
      ['groq', 'openai/gpt-oss-120b'],
      ['nvidia', 'nvidia/nemotron-3-super-120b-a12b'],
      ['nvidia', 'meta/llama-3.3-70b-instruct'],
      ['openrouter', 'nvidia/nemotron-3-super-120b-a12b:free'],
      ['openrouter', 'openai/gpt-oss-20b:free'],
      ['openrouter', 'openrouter/free'],
      ['xai', 'grok-4.5'],
    ]);
  });

  it('includes every configured model in health checks', () => {
    expect(
      buildProviderHealthAttempts().map(({ name, model, configured }) => [
        name,
        model,
        configured,
      ]),
    ).toEqual([
      ['bai', 'glm-5.3-flash', true],
      ['groq', 'openai/gpt-oss-120b', true],
      ['google-ai-studio', 'gemini-3.5-flash', true],
      ['google-ai-studio', 'gemini-3.5-flash-lite', true],
      ['nvidia', 'meta/llama-3.3-70b-instruct', true],
      ['nvidia', 'nvidia/nemotron-3-super-120b-a12b', true],
      ['openrouter', 'nvidia/nemotron-3-super-120b-a12b:free', true],
      ['openrouter', 'openai/gpt-oss-20b:free', true],
      ['openrouter', 'openrouter/free', true],
      ['xai', 'grok-4.5', true],
    ]);
  });
});
