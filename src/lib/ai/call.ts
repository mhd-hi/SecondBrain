import type { OpenAI } from 'openai';
import { getAIClient } from './client';
import { buildProviderAttempts } from './providers';

type AICallResult = {
  text: string;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  model?: string;
  provider?: string;
  finish_reason?: string | null;
};

export async function callWithFallback(
  messages: {
    role: 'system' | 'user' | 'assistant' | string;
    content: string;
  }[],
): Promise<AICallResult> {
  const sdkMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  })) as unknown as OpenAI.ChatCompletionCreateParams['messages'];

  const attempts = buildProviderAttempts();
  let lastError: Error | undefined;

  for (const attempt of attempts) {
    const client = getAIClient(attempt);

    try {
      const completion = (await client.chat.completions.create({
        model: attempt.model,
        messages: sdkMessages,
        temperature: 0,
      })) as OpenAI.ChatCompletion;
      const choice = completion.choices?.[0];
      const text = choice?.message?.content ?? '';

      if (!text.trim()) {
        throw new Error('Empty response');
      }

      return {
        text,
        usage: completion.usage,
        model: completion.model,
        provider: attempt.name,
        finish_reason: choice?.finish_reason ?? null,
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`AI provider failed: ${attempt.name} (${attempt.model})`, lastError.message);
    }
  }

  throw new Error('All AI providers failed or are unconfigured', {
    cause: lastError,
  });
}
