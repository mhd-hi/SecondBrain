import { sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { aiModelStats } from '@/server/db/schema';

export function aiErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'UNKNOWN_ERROR';
  }

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
  if (typeof metadata.name === 'string') {
    return metadata.name;
  }
  return 'UNKNOWN_ERROR';
}

export async function recordAIModelAttempt({
  provider,
  model,
  status,
  errorCode = '',
  latencyMs,
}: {
  provider: string;
  model: string;
  status: 'success' | 'error';
  errorCode?: string;
  latencyMs: number;
}) {
  try {
    await db
      .insert(aiModelStats)
      .values({
        provider,
        model,
        status,
        errorCode,
        count: 1,
        lastLatencyMs: latencyMs,
      })
      .onConflictDoUpdate({
        target: [
          aiModelStats.provider,
          aiModelStats.model,
          aiModelStats.status,
          aiModelStats.errorCode,
        ],
        set: {
          count: sql`${aiModelStats.count} + 1`,
          lastLatencyMs: latencyMs,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.warn('AI model stats write failed', {
      errorCode: aiErrorCode(error),
    });
  }
}
