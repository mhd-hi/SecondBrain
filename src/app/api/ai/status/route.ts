import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getAIClient } from '@/lib/ai/client';
import { buildProviderHealthAttempts } from '@/lib/ai/providers';
import { withAuthSimple } from '@/lib/auth/api';

const MODEL_TIMEOUT_MS = 10_000;

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/ai/status:
 *   get:
 *     summary: Check configured AI model availability
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: AI model health results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [checkedAt, models]
 *               properties:
 *                 checkedAt:
 *                   type: string
 *                   format: date-time
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required: [provider, model, status]
 *                     properties:
 *                       provider:
 *                         type: string
 *                       model:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [ok, error]
 *                       latencyMs:
 *                         type: number
 *                       error:
 *                         type: string
 *                         description: NOT_CONFIGURED, TIMEOUT, REQUEST_FAILED, provider code, or HTTP status like HTTP_429
 *       401:
 *         description: Authentication required
 */
function statusError(
  error: unknown,
  timeoutSignal: AbortSignal,
  elapsedMs: number,
) {
  if (timeoutSignal.aborted || elapsedMs >= MODEL_TIMEOUT_MS) {
    return 'TIMEOUT';
  }
  if (error && typeof error === 'object') {
    const metadata = error as {
      name?: unknown;
      status?: unknown;
      code?: unknown;
    };
    if (metadata.name === 'TimeoutError' || metadata.code === 'ETIMEDOUT') {
      return 'TIMEOUT';
    }
    if (typeof metadata.code === 'string') {
      return metadata.code;
    }
    if (typeof metadata.status === 'number') {
      return `HTTP_${metadata.status}`;
    }
  }
  return 'REQUEST_FAILED';
}

const getProviderHealth = unstable_cache(async () => {
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
      const timeoutSignal = AbortSignal.timeout(MODEL_TIMEOUT_MS);
      try {
        await getAIClient(attempt).chat.completions.create(
          {
            model: attempt.model,
            messages: [{ role: 'user', content: 'Reply with OK.' }],
            max_tokens: 8,
          },
          {
            signal: timeoutSignal,
          },
        );
        return {
          provider: attempt.name,
          model: attempt.model,
          status: 'ok' as const,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        return {
          provider: attempt.name,
          model: attempt.model,
          status: 'error' as const,
          latencyMs,
          error: statusError(error, timeoutSignal, latencyMs),
        };
      }
    }),
  );

  return { checkedAt: new Date().toISOString(), models: results };
}, ['ai-provider-health'], { revalidate: 60 });

export const GET = withAuthSimple(async () => {
  return NextResponse.json(
    await getProviderHealth(),
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
});
