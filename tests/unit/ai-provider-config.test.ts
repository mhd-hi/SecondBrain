import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  env: {
    GROQ_API_KEY: 'groq',
    GOOGLE_AI_STUDIO_API_KEY: 'google',
    NVIDIA_API_KEY: 'nvidia',
    OPENROUTER_API_KEY: 'openrouter',
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
      ['groq', 'openai/gpt-oss-120b'],
      ['google-ai-studio', 'gemini-3.6-flash'],
      ['nvidia', 'meta/llama-3.3-70b-instruct'],
      ['nvidia', 'nvidia/nemotron-3-super-120b-a12b'],
      ['openrouter', 'openai/gpt-oss-20b:free'],
      ['openrouter', 'openrouter/free'],
    ]);
  });

  it('uses the separate chat provider and model order', () => {
    expect(
      buildChatProviderAttempts().map(({ name, model }) => [name, model]),
    ).toEqual([
      ['google-ai-studio', 'gemini-3.6-flash'],
      ['groq', 'openai/gpt-oss-120b'],
      ['nvidia', 'nvidia/nemotron-3-super-120b-a12b'],
      ['nvidia', 'meta/llama-3.3-70b-instruct'],
      ['openrouter', 'openai/gpt-oss-20b:free'],
      ['openrouter', 'openrouter/free'],
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
      ['groq', 'openai/gpt-oss-120b', true],
      ['google-ai-studio', 'gemini-3.6-flash', true],
      ['nvidia', 'meta/llama-3.3-70b-instruct', true],
      ['nvidia', 'nvidia/nemotron-3-super-120b-a12b', true],
      ['openrouter', 'openai/gpt-oss-20b:free', true],
      ['openrouter', 'openrouter/free', true],
    ]);
  });
});
