import type { OpenAI } from 'openai';
import { getAIClient } from './client';
import { AIError } from './error';
import { buildProviderAttempts, type ProviderAttempt } from './providers';

const ATTEMPT_TIMEOUT_MS = 20_000;
const OVERALL_TIMEOUT_MS = 60_000;

export type AICallResult = {
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

type RequestOptions = Partial<
  Omit<
    OpenAI.ChatCompletionCreateParamsNonStreaming,
    'messages' | 'model' | 'stream'
  >
>;

type FallbackOptions = {
  signal?: AbortSignal;
  validate?: (
    text: string,
    attempt: ProviderAttempt,
  ) => unknown | Promise<unknown>;
  requestOptions?: (attempt: ProviderAttempt) => RequestOptions;
};

function errorMetadata(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { errorName: 'UnknownError' };
  }

  const candidate = error as {
    name?: unknown;
    status?: unknown;
    code?: unknown;
  };

  return {
    errorName:
      typeof candidate.name === 'string' ? candidate.name : 'UnknownError',
    ...(typeof candidate.status === 'number' && {
      providerStatus: candidate.status,
    }),
    ...((typeof candidate.code === 'string' ||
      typeof candidate.code === 'number') && { providerCode: candidate.code }),
  };
}

export async function callWithFallback(
  messages: {
    role: 'system' | 'user' | 'assistant' | string;
    content: string;
  }[],
  options: FallbackOptions = {},
): Promise<AICallResult> {
  const sdkMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  })) as unknown as OpenAI.ChatCompletionCreateParams['messages'];

  const attempts = buildProviderAttempts();
  const overallSignal = AbortSignal.timeout(OVERALL_TIMEOUT_MS);
  if (options.signal?.aborted) {
    throw new AIError('AI_ABORTED');
  }

  for (const attempt of attempts) {
    if (options.signal?.aborted) {
      throw new AIError('AI_ABORTED');
    }
    if (overallSignal.aborted) {
      throw new AIError('AI_DEADLINE_EXCEEDED');
    }

    const startedAt = Date.now();
    const attemptSignal = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
    const signal = AbortSignal.any(
      [options.signal, overallSignal, attemptSignal].filter(
        (candidate): candidate is AbortSignal => candidate !== undefined,
      ),
    );
    try {
      const client = getAIClient(attempt);
      const completion = (await client.chat.completions.create(
        {
          model: attempt.model,
          messages: sdkMessages,
          ...options.requestOptions?.(attempt),
        },
        { signal },
      )) as OpenAI.ChatCompletion;
      const choice = completion.choices?.[0];
      const text = choice?.message?.content ?? '';

      if (!text.trim()) {
        throw new Error('Empty response');
      }
      await options.validate?.(text, attempt);

      console.info('AI provider succeeded', {
        provider: attempt.name,
        model: attempt.model,
        durationMs: Date.now() - startedAt,
        responseLength: text.length,
      });

      return {
        text,
        usage: completion.usage,
        model: completion.model,
        provider: attempt.name,
        finish_reason: choice?.finish_reason ?? null,
      };
    } catch (error: unknown) {
      if (options.signal?.aborted) {
        throw new AIError('AI_ABORTED');
      }
      if (overallSignal.aborted) {
        throw new AIError('AI_DEADLINE_EXCEEDED');
      }

      console.warn('AI provider failed', {
        provider: attempt.name,
        model: attempt.model,
        durationMs: Date.now() - startedAt,
        ...errorMetadata(error),
      });
    }
  }

  throw new AIError('AI_PROVIDERS_EXHAUSTED');
}
