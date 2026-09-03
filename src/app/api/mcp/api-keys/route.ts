import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { and, count, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { mcpConnections } from '@/server/db/schema';
import { withAuthSimple } from '@/lib/auth/api';
import { isUserMcpEnabled, MCP_API_KEY_PREFIX, MCP_SCOPES, sha256Hex } from '@/lib/auth/mcp';

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
  let body: { label?: unknown; readOnly?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (label.length < 1 || label.length > 40) {
    return NextResponse.json(
      { error: 'Label must be 1-40 characters' },
      { status: 400 },
    );
  }

  const readOnly = body.readOnly === true;
  const scopes = readOnly ? [MCP_SCOPES[0]] : [...MCP_SCOPES];

  if (!isUserMcpEnabled(user.id)) {
    return NextResponse.json(
      { error: 'This account is not enabled for MCP access' },
      { status: 403 },
    );
  }

  const [active] = await db
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
    return NextResponse.json(
      { error: `Maximum ${MAX_ACTIVE_KEYS_PER_USER} active keys reached. Revoke one first.` },
      { status: 409 },
    );
  }

  const key = `${MCP_API_KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString('base64url')}`;
  const inserted = await db
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
    .returning({ id: mcpConnections.id, keyPrefix: mcpConnections.keyPrefix });

  const created = inserted[0];
  if (!created) {
    return NextResponse.json(
      { error: 'Could not create API key' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: created.id,
    keyPrefix: created.keyPrefix,
    key,
    scopes,
  });
});
