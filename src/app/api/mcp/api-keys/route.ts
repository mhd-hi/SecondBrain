import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { mcpConnections } from '@/server/db/schema';
import { withAuthSimple } from '@/lib/auth/api';
import { MCP_API_KEY_PREFIX, MCP_SCOPES, sha256Hex } from '@/lib/auth/mcp';
import { requireSameOrigin } from '@/lib/auth/origin';

/**
 * Browser-authenticated API key management (Preferences > MCP API keys).
 * Creates static API keys that authenticate to /api/mcp as the signed-in
 * user. The full key is returned exactly once; only its sha256 hash is
 * stored (safe for high-entropy secrets). Revocation reuses the existing
 * /api/mcp/connections DELETE — every key is an mcp_connections row, so
 * the allowlist, rate limits, audit events, and immediate revocation all
 * apply without extra code.
 */

const MAX_ACTIVE_KEYS_PER_USER = 10;
const KEY_RANDOM_BYTES = 32;

export const POST = withAuthSimple(async (request, user) => {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }
  if (
    request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    return NextResponse.json({ error: 'Expected application/json' }, { status: 415 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = z.strictObject({
    label: z.string().trim().min(1).max(40),
    readOnly: z.boolean().optional(),
  }).safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Label must be 1-40 characters; readOnly must be boolean' },
      { status: 400 },
    );
  }

  const { label, readOnly } = parsed.data;
  const scopes = readOnly === true ? [MCP_SCOPES[0]] : [...MCP_SCOPES];

  const key = `${MCP_API_KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString('base64url')}`;
  const created = await db.transaction(async (tx) => {
    // Serialize key creation per user; count + insert must share this lock.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`,
    );
    const [active] = await tx
      .select({ value: count() })
      .from(mcpConnections)
      .where(
        and(
          eq(mcpConnections.userId, user.id),
          isNull(mcpConnections.revokedAt),
          isNotNull(mcpConnections.keyHash),
        ),
      );
    if (Number(active?.value ?? 0) >= MAX_ACTIVE_KEYS_PER_USER) {
      return null;
    }
    const inserted = await tx
      .insert(mcpConnections)
      .values({
        userId: user.id,
        oauthIssuer: 'local',
        oauthSubject: user.id,
        oauthClientId: 'api-key',
        oauthGrantId: `api-key:${crypto.randomUUID()}`,
        clientName: label,
        scopes,
        keyHash: sha256Hex(key),
        keyPrefix: key.slice(0, 16),
      })
      .returning({
        id: mcpConnections.id,
        keyPrefix: mcpConnections.keyPrefix,
      });
    return inserted[0] ?? null;
  });

  if (!created) {
    return NextResponse.json(
      {
        error: `Maximum ${MAX_ACTIVE_KEYS_PER_USER} active keys reached. Revoke one first.`,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      id: created.id,
      keyPrefix: created.keyPrefix,
      key,
      scopes,
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
});
