import { NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { buildProviderHealthAttempts } from '@/lib/ai/providers';
import { withAuthSimple } from '@/lib/auth/api';

const MODEL_TIMEOUT_MS = 10_000;

export const dynamic = 'force-dynamic';

export const GET = withAuthSimple(async (request) => {
  const results = await Promise.all(
    buildProviderHealthAttempts().map(async (attempt) => {
      if (!attempt.configured) {
        return {
          provider: attempt.name,
          model: attempt.model,
          status: 'error' as const,
          error: 'NOT_CONFIGURED',
        };
      }

      const startedAt = Date.now();
      try {
        await getAIClient(attempt).chat.completions.create(
          {
            model: attempt.model,
            messages: [{ role: 'user', content: 'Reply with OK.' }],
            max_tokens: 8,
          },
          {
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(MODEL_TIMEOUT_MS),
            ]),
          },
        );
        return {
          provider: attempt.name,
          model: attempt.model,
          status: 'ok' as const,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        const metadata =
          error && typeof error === 'object'
            ? (error as { status?: unknown; code?: unknown })
            : {};
        return {
          provider: attempt.name,
          model: attempt.model,
          status: 'error' as const,
          latencyMs: Date.now() - startedAt,
          error: request.signal.aborted
            ? 'ABORTED'
            : typeof metadata.code === 'string'
              ? metadata.code
              : typeof metadata.status === 'number'
                ? `HTTP_${metadata.status}`
                : 'REQUEST_FAILED',
        };
      }
    }),
  );

  return NextResponse.json(
    { checkedAt: new Date().toISOString(), models: results },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
});
