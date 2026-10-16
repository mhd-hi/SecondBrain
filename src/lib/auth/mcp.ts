import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { mcpAuditEvents, mcpConnections } from '@/server/db/schema';

/**
 * MCP bearer-token authentication boundary.
 *
 * Every `/api/mcp` request is authenticated here, independently: the Auth.js
 * browser session cookie is never consulted (plan section 6.3/16). The token
 * is a static API key (`sb_mcp_` prefix, created in Preferences > MCP & AI
 * Clients) that resolves to exactly one active (non-revoked) `mcp_connections`
 * row by its sha256 hash. Identity comes from that key's row, never from tool
 * input.
 */

export const MCP_SCOPES = ['secondbrain:read', 'secondbrain:write'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

/**
 * Prefix for user-created static API keys (Preferences > MCP API keys).
 * Keys are 256-bit random secrets, shown once, stored only as sha256 hashes
 * (fine for high-entropy secrets, unlike passwords). The prefix is the
 * boundary's fast-path signal that this is an API key.
 */
export const MCP_API_KEY_PREFIX = 'sb_mcp_';

export type McpAuthContext = {
  userId: string;
  connectionId: string;
  clientId: string;
  grantId: string;
  issuer: string;
  scopes: string[];
  apiKey?: true;
};

export type McpAuthFailure = {
  status: 401 | 403;
  code:
    | 'invalid_token'
    | 'insufficient_scope'
    | 'token_required'
    | 'connection_revoked';
  errorDescription: string;
  scope?: string;
};

export class McpAuthError extends Error {
  readonly status: 401 | 403;
  readonly code: McpAuthFailure['code'];
  readonly errorDescription: string;
  readonly scope?: string;

  constructor(failure: McpAuthFailure) {
    super(failure.errorDescription);
    this.name = 'McpAuthError';
    this.status = failure.status;
    this.code = failure.code;
    this.errorDescription = failure.errorDescription;
    this.scope = failure.scope;
  }
}

export function sha256Hex(value: string): string {
  // High-entropy 256-bit API keys/capabilities, not passwords; sha256 enables indexed lookup.
  return createHash('sha256').update(value).digest('hex'); // codeql[js/insufficient-password-hash]
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function buildWwwAuthenticateChallenge({
  code,
  errorDescription,
  scope,
  resourceMetadataUrl,
}: {
  status: 401 | 403;
  code: McpAuthFailure['code'];
  errorDescription: string;
  scope?: string;
  resourceMetadataUrl: string;
}): string {
  const base = `Bearer realm="second-brain-mcp", error="${code}", error_description="${errorDescription.replaceAll('"', "'")}", resource_metadata="${resourceMetadataUrl}"`;
  return scope ? `${base}, scope="${scope}"` : base;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) {
    return null;
  }
  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || rest.length === 0) {
    return null;
  }
  const token = rest.join(' ').trim();
  return token || null;
}

/**
 * Authenticate one MCP request. Throws McpAuthError on any failure.
 *
 * The bearer token must be a static API key (sb_mcp_ prefix). Anything else
 * fails closed as an unknown key — there is no other token format.
 *
 * Order of checks: bearer presence -> sb_mcp_ prefix -> hash lookup and
 * timing-safe compare -> revocation check.
 */
export async function authenticateMcpRequest(
  request: Request,
): Promise<McpAuthContext> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new McpAuthError({
      status: 401,
      code: 'token_required',
      errorDescription: 'Bearer token required',
    });
  }

  if (!token.startsWith(MCP_API_KEY_PREFIX)) {
    throw new McpAuthError({
      status: 401,
      code: 'invalid_token',
      errorDescription: 'Unknown API key',
    });
  }

  return authenticateApiKey(token);
}

/**
 * Static API-key authentication path (Preferences > MCP API keys).
 * The presented token is sha256-hashed and looked up directly; no signature,
 * issuer, or expiry validation applies because the key itself is the secret.
 * Compromise response: revoke from the UI (immediate, checked every request).
 *
 * Timing-attack resistance: the expensive, variable part of a guess is the
 * sha256 of the token, which every request performs exactly once up front.
 * Each failure path then burns one additional same-input-size sha256 and one
 * timing-safe compare before throwing, so response latency cannot distinguish
 * unknown key from revoked key. The DB read is an indexed unique-key point
 * read with the same cost whether or not a row matches. Network jitter far
 * exceeds the residual differences.
 */
async function authenticateApiKey(token: string): Promise<McpAuthContext> {
  const hash = sha256Hex(token);
  const candidate = await db
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.keyHash, hash))
    .limit(1)
    .then((rows) => rows[0]);

  let connection: typeof candidate | undefined;
  if (candidate?.keyHash && timingSafeEqualStr(candidate.keyHash, hash)) {
    connection = candidate;
  }
  if (!connection) {
    // Failure padding: same sha256 + compare work as the success path.
    timingSafeEqualStr(sha256Hex(hash), hash);
    throw new McpAuthError({
      status: 401,
      code: 'invalid_token',
      errorDescription: 'Unknown API key',
    });
  }
  if (connection.revokedAt) {
    timingSafeEqualStr(sha256Hex(hash), hash);
    throw new McpAuthError({
      status: 401,
      code: 'connection_revoked',
      errorDescription: 'API key has been revoked',
    });
  }

  return {
    userId: connection.userId,
    connectionId: connection.id,
    clientId: 'api-key',
    grantId: `api-key:${connection.id}`,
    issuer: 'local',
    scopes: connection.scopes,
    apiKey: true,
  };
}

export function requireScopes(
  context: Pick<McpAuthContext, 'scopes'>,
  needed: readonly McpScope[],
): void {
  const granted = new Set(context.scopes);
  const missing = needed.filter((scope) => !granted.has(scope));
  if (missing.length > 0) {
    throw new McpAuthError({
      status: 403,
      code: 'insufficient_scope',
      errorDescription: `Insufficient scope: ${missing.join(', ')}`,
      scope: missing.join(' '),
    });
  }
}

export async function touchConnectionLastUsed(
  connectionId: string,
  apiKey = false,
): Promise<void> {
  await db
    .update(mcpConnections)
    .set(apiKey ? { lastUsedAt: new Date(), keyLastUsedAt: new Date() } : { lastUsedAt: new Date() })
    .where(eq(mcpConnections.id, connectionId));
}

export async function recordMcpAuditEvent(entry: {
  userId: string;
  connectionId: string | null;
  toolName: string;
  draftId?: string | null;
  outcome: string;
  correlationId: string;
  durationMs?: number;
  tx?: Pick<typeof db, 'insert'>;
}): Promise<void> {
  const executor = entry.tx ?? db;
  await executor.insert(mcpAuditEvents).values({
    userId: entry.userId,
    connectionId: entry.connectionId,
    toolName: entry.toolName,
    draftId: entry.draftId ?? null,
    outcome: entry.outcome,
    correlationId: entry.correlationId,
    durationMs: entry.durationMs ?? null,
  });
}
