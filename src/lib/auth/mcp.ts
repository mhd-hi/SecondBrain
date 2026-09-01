import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { db } from '@/server/db';
import { mcpAuditEvents, mcpConnections } from '@/server/db/schema';

/**
 * MCP bearer-token authentication boundary.
 *
 * Every `/api/mcp` request is authenticated here, independently: the Auth.js
 * browser session cookie is never consulted (plan section 6.3/16). The token
 * must be issued by the configured authorization server, bound to this MCP
 * resource audience, carry the required scopes, and resolve to exactly one
 * active (non-revoked) Second Brain connection keyed by
 * `(issuer, grant_id)`.
 *
 * Provider selection (plan section 8.4) is not finalized yet; this boundary
 * only depends on the claim shape defined in the plan's example claims block,
 * so swapping providers never touches domain tools.
 */

export const MCP_SCOPES = ['secondbrain:read', 'secondbrain:write'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_RESOURCE_AUDIENCE = 'second-brain-mcp';

export type McpAuthContext = {
  userId: string;
  connectionId: string;
  clientId: string;
  grantId: string;
  issuer: string;
  scopes: string[];
};

export type McpAuthFailure = {
  status: 401 | 403;
  code:
    | 'invalid_token'
    | 'insufficient_scope'
    | 'token_required'
    | 'connection_revoked'
    | 'connection_mismatch';
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

export function isMcpAuthConfigured(): boolean {
  return Boolean(process.env.MCP_OAUTH_ISSUER && process.env.MCP_OAUTH_AUDIENCE);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new McpAuthError({
      status: 401,
      code: 'invalid_token',
      errorDescription: 'MCP authentication is not configured',
    });
  }
  return value;
}

type TokenClaims = {
  sub?: unknown;
  aud?: unknown;
  iss?: unknown;
  exp?: unknown;
  nbf?: unknown;
  scope?: unknown;
  client_id?: unknown;
  grant_id?: unknown;
};

function claimString(claims: TokenClaims, key: keyof TokenClaims): string {
  const value = claims[key];
  return typeof value === 'string' ? value : '';
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

type VerifiedToken = {
  payload: TokenClaims & { [key: string]: unknown };
  claims: {
    sub: string;
    clientId: string;
    grantId: string;
    issuer: string;
    scope: string;
  };
};

async function verifyTokenStructure(
  token: string,
): Promise<VerifiedToken['payload']> {
  const issuer = requiredEnv('MCP_OAUTH_ISSUER');
  const audience = requiredEnv('MCP_OAUTH_AUDIENCE');

  let payload: VerifiedToken['payload'];
  try {
    const verifyOptions: Parameters<typeof jwtVerify>[2] = {
      issuer,
      audience,
      clockTolerance: 5,
    };
    const jwksUri = process.env.MCP_OAUTH_JWKS_URI;
    const verification = jwksUri
      ? await jwtVerify(token, createRemoteJWKSet(new URL(jwksUri)), verifyOptions)
      : await jwtVerify(
          token,
          async (header) => {
            if (header.alg === 'HS256') {
              // Symmetric tokens: production uses the authorization server's
              // MCP_OAUTH_SECRET. MCP_DEV_TOKEN_SECRET is a development-only
              // alternative so local smoke tests can mint tokens without a
              // real provider; it is honored only outside production.
              const rawSecret =
                process.env.MCP_OAUTH_SECRET ||
                (process.env.NODE_ENV !== 'production'
                  ? process.env.MCP_DEV_TOKEN_SECRET
                  : undefined);
              if (!rawSecret) {
                throw new McpAuthError({
                  status: 401,
                  code: 'invalid_token',
                  errorDescription:
                    'MCP authentication is not configured for symmetric tokens',
                });
              }
              return new TextEncoder().encode(rawSecret);
            }
            throw new McpAuthError({
              status: 401,
              code: 'invalid_token',
              errorDescription: `Unsupported signing algorithm: ${header.alg ?? 'unknown'}`,
            });
          },
          verifyOptions,
        );
    payload = verification.payload as VerifiedToken['payload'];
  } catch (error) {
    if (error instanceof McpAuthError) {
      throw error;
    }
    throw new McpAuthError({
      status: 401,
      code: 'invalid_token',
      errorDescription: 'Token validation failed',
    });
  }

  const sub = claimString(payload, 'sub');
  const clientId = claimString(payload, 'client_id');
  const grantId = claimString(payload, 'grant_id');
  const scope = claimString(payload, 'scope');
  if (!sub || !clientId || !grantId || !scope) {
    throw new McpAuthError({
      status: 401,
      code: 'invalid_token',
      errorDescription: 'Token is missing required claims (sub, client_id, grant_id, scope)',
    });
  }
  return payload;
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
 * Order of checks: bearer presence -> structural verification (signature,
 * issuer, audience, expiry) -> claim presence -> scope -> connection
 * resolution and revocation check.
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

  const payload = await verifyTokenStructure(token);
  const sub = claimString(payload, 'sub');
  const clientId = claimString(payload, 'client_id');
  const grantId = claimString(payload, 'grant_id');
  const scope = claimString(payload, 'scope');
  const issuer = claimString(payload, 'iss');

  const connection = await db
    .select()
    .from(mcpConnections)
    .where(
      eq(mcpConnections.oauthGrantId, grantId),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!connection) {
    throw new McpAuthError({
      status: 401,
      code: 'connection_revoked',
      errorDescription: 'No active connection for this authorization grant',
    });
  }
  if (
    connection.revokedAt ||
    connection.userId !== sub ||
    connection.oauthClientId !== clientId ||
    connection.oauthIssuer !== issuer ||
    connection.oauthSubject !== sub
  ) {
    throw new McpAuthError({
      status: 401,
      code: 'connection_revoked',
      errorDescription: 'Connection revoked or token claims do not match',
    });
  }

  // Staged rollout allowlist (plan section 20, Phase 6 / section 22.1 private
  // alpha): when MCP_ENABLED_USERS is set, only listed user IDs may connect.
  // Empty/unset means the MCP surface is open to all authenticated users.
  const allowlist = (process.env.MCP_ENABLED_USERS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(sub)) {
    throw new McpAuthError({
      status: 403,
      code: 'insufficient_scope',
      errorDescription: 'This account is not enabled for MCP access',
    });
  }

  return {
    userId: sub,
    connectionId: connection.id,
    clientId,
    grantId,
    issuer,
    scopes: scope.split(/[\s+]/).filter(Boolean),
  };
}

export function requireScopes(
  context: McpAuthContext,
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
): Promise<void> {
  await db
    .update(mcpConnections)
    .set({ lastUsedAt: new Date() })
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
// env values are read at request time; see docs/mcp-adr.md
