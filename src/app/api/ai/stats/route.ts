import { NextResponse } from 'next/server';
import { buildProviderHealthAttempts } from '@/lib/ai/providers';
import { withAuthSimple } from '@/lib/auth/api';
import { db } from '@/server/db';
import { aiModelStats } from '@/server/db/schema';

export const dynamic = 'force-dynamic';

function modelKey(provider: string, model: string) {
  return JSON.stringify([provider, model]);
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * @swagger
 * /api/ai/stats:
 *   get:
 *     summary: Get AI model success and error statistics
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: AI model statistics grouped by provider and model
 *       401:
 *         description: Authentication required
 */
export const GET = withAuthSimple(async () => {
  const activeModels = buildProviderHealthAttempts().map(attempt => ({
    key: modelKey(attempt.name, attempt.model),
    provider: attempt.name,
    model: attempt.model,
    active: attempt.configured,
  }));
  const stats = await db.select().from(aiModelStats);
  const models = new Map<
    string,
    {
      provider: string;
      model: string;
      active: boolean;
      successCount: number;
      errorCount: number;
      errors: {
        error: string;
        count: number;
        lastLatencyMs: number | null;
        lastSeenAt: string;
      }[];
      lastSeenAt: string | null;
      lastLatencyMs: number | null;
    }
  >();

  for (const model of activeModels) {
    models.set(model.key, {
      provider: model.provider,
      model: model.model,
      active: model.active,
      successCount: 0,
      errorCount: 0,
      errors: [],
      lastSeenAt: null,
      lastLatencyMs: null,
    });
  }

  for (const row of stats) {
    const key = modelKey(row.provider, row.model);
    const current =
      models.get(key) ??
      {
        provider: row.provider,
        model: row.model,
        active: false,
        successCount: 0,
        errorCount: 0,
        errors: [],
        lastSeenAt: null,
        lastLatencyMs: null,
      };
    const lastSeenAt = isoDate(row.updatedAt);

    if (!current.lastSeenAt || lastSeenAt > current.lastSeenAt) {
      current.lastSeenAt = lastSeenAt;
      current.lastLatencyMs = row.lastLatencyMs;
    }
    if (row.status === 'success') {
      current.successCount += row.count;
    } else {
      current.errorCount += row.count;
      current.errors.push({
        error: row.errorCode || 'UNKNOWN_ERROR',
        count: row.count,
        lastLatencyMs: row.lastLatencyMs,
        lastSeenAt,
      });
    }
    models.set(key, current);
  }

  return NextResponse.json(
    {
      models: [...models.values()].sort((a, b) =>
        `${a.provider}:${a.model}`.localeCompare(`${b.provider}:${b.model}`),
      ),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
});
