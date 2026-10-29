import { Buffer } from 'node:buffer';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { mcpAuditEvents, mcpConnections } from '@/server/db/schema';

/**
 * MCP bearer-token authentication boundary.
 *
 * Every `/api/mcp` request is authenticated here, independently: the Auth.js
 * browser session cookie is never consulted (plan section 6.3/16). The token
 * is a static API key (`sb_mcp_` prefix, created in Settings > MCP & AI
 * Clients) that resolves to exactly one active (non-revoked) `mcp_connections`
 * row by prefix lookup plus scrypt verification. Identity comes from that
 * key's row, never from tool input.
 */

export const MCP_SCOPES = ['secondbrain:read', 'secondbrain:write'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

/**
 * Prefix for user-created static API keys (Settings > MCP API keys).
 * Keys are 256-bit random secrets, shown once, stored only as salted scrypt
 * verifiers. The prefix doubles as the non-secret lookup id: authentication
 * routes by the key's first 16 chars, then verifies with scrypt.
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
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Password-style storage for bearer secrets (MCP API keys, approval
 * capabilities). scrypt with a per-secret random salt; stored as
 * `scrypt$N$r$p$salthex$derivedhex` so parameters travel with the verifier.
 *
 * Indexed fast hashes are deliberately NOT used here: a database/table leak
 * must not hand out offline-testable hashes. Fast SHA-256 remains only for
 * non-sensitive canonical request hashing (idempotency), never for secrets.
 */
const scryptAsync = (
  secret: string,
  salt: Buffer,
  keyLengthBytes: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(secret, salt, keyLengthBytes, options, (error, derived) => {
      if (error || !Buffer.isBuffer(derived)) {
        reject(error ?? new Error('scrypt failed'));
      } else {
        resolve(derived);
      }
    });
  });

const SECRET_KDF = {
  N: 16384,
  r: 8,
  p: 1,
  keyLengthBytes: 32,
  saltBytes: 16,
  maxMemoryBytes: 32 * 1024 * 1024,
} as const;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(SECRET_KDF.saltBytes);
  const derived = (await scryptAsync(secret, salt, SECRET_KDF.keyLengthBytes, {
    N: SECRET_KDF.N,
    r: SECRET_KDF.r,
    p: SECRET_KDF.p,
    maxmem: SECRET_KDF.maxMemoryBytes,
  })) as Buffer;
  return [
    'scrypt',
    SECRET_KDF.N,
    SECRET_KDF.r,
    SECRET_KDF.p,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

export async function verifySecret(
  secret: string,
  stored: string | null | undefined,
): Promise<boolean> {
  const parts = stored?.split('$') ?? [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, nRaw, rRaw, pRaw, saltHex, expectedHex] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N <= 0 ||
    r <= 0 ||
    p <= 0
  ) {
    return false;
  }
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  try {
    const derived = (await scryptAsync(secret, salt, expected.length, {
      N,
      r,
      p,
      maxmem: SECRET_KDF.maxMemoryBytes,
    })) as Buffer;
    return (
      derived.length === expected.length &&
      timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
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
 * Static API-key authentication path (Settings > MCP API keys).
 * The presented key is routed by its 16-char prefix (a non-secret lookup id
 * displayed in the UI) and verified with scrypt against the stored verifier;
 * no signature, issuer, or expiry validation applies because the key itself
 * is the secret. Compromise response: revoke from the UI (immediate, checked
 * every request).
 *
 * Timing posture: a prefix miss fails fast with no KDF work, so
 * unauthenticated garbage cannot burn scrypt CPU. The prefix is a routing id,
 * not a secret, so a prefix-existence oracle is harmless. A valid prefix
 * with a wrong secret costs exactly one verification.
 */
async function authenticateApiKey(token: string): Promise<McpAuthContext> {
  const candidates = await db
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.keyPrefix, token.slice(0, 16)))
    .limit(10);

  let connection: (typeof candidates)[number] | undefined;
  for (const candidate of candidates) {
    if (await verifySecret(token, candidate.keyVerifier)) {
      connection = candidate;
      break;
    }
  }
  if (!connection) {
    throw new McpAuthError({
      status: 401,
      code: 'invalid_token',
      errorDescription: 'Unknown API key',
    });
  }
  if (connection.revokedAt) {
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
