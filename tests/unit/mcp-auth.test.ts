import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectionRow = {
  id: 'conn-1',
  userId: 'user-1',
  oauthIssuer: 'https://issuer.example.com',
  oauthSubject: 'user-1',
  oauthClientId: 'client-1',
  oauthGrantId: 'grant-1',
  revokedAt: null as Date | null,
};

// When true, the connection lookup resolves to no row (unknown grant).
let grantLookupEmpty = false;

vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (grantLookupEmpty ? [] : [connectionRow]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  },
}));

const { authenticateMcpRequest, requireScopes, McpAuthError, sha256Hex } =
  await import('@/lib/auth/mcp');
type McpAuthErrorType = Awaited<ReturnType<typeof authenticateMcpRequest>> extends never ? never : import('@/lib/auth/mcp').McpAuthError;

const ISSUER = 'https://issuer.example.com';
const AUDIENCE = 'second-brain-mcp';
const SECRET = new TextEncoder().encode('test-secret-at-least-32-characters!!');

async function mintToken(overrides?: {
  subject?: string;
  issuer?: string;
  audience?: string | string[];
  scope?: string;
  clientId?: string;
  grantId?: string;
  expiresIn?: string;
  alg?: 'HS256' | 'none';
}) {
  const options = {
    subject: 'user-1',
    issuer: ISSUER,
    audience: AUDIENCE as string | string[],
    scope: 'secondbrain:read secondbrain:write',
    clientId: 'client-1',
    grantId: 'grant-1',
    expiresIn: '1h',
    ...overrides,
  };
  const jwt = new SignJWT({
    scope: options.scope,
    client_id: options.clientId,
    grant_id: options.grantId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(options.subject)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn);
  return jwt.sign(SECRET);
}

function requestWith(token: string | null): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return new Request('http://localhost:3000/api/mcp', { headers });
}

describe('MCP token boundary (plan 21.1)', () => {
  beforeEach(() => {
    process.env.MCP_OAUTH_ISSUER = ISSUER;
    process.env.MCP_OAUTH_AUDIENCE = AUDIENCE;
    delete process.env.MCP_OAUTH_JWKS_URI;
    process.env.MCP_OAUTH_SECRET = 'test-secret-at-least-32-characters!!';
    connectionRow.userId = 'user-1';
    connectionRow.oauthSubject = 'user-1';
    connectionRow.oauthClientId = 'client-1';
    connectionRow.oauthIssuer = ISSUER;
    connectionRow.revokedAt = null;
  });

  it('accepts a valid token from the configured issuer and audience', async () => {
    const token = await mintToken();
    const context = await authenticateMcpRequest(requestWith(token));

    expect(context.userId).toBe('user-1');
    expect(context.connectionId).toBe('conn-1');
    expect(context.scopes).toContain('secondbrain:write');
    expect(context.grantId).toBe('grant-1');
  });

  it('rejects a missing bearer token', async () => {
    await expect(authenticateMcpRequest(requestWith(null))).rejects.toMatchObject(
      { status: 401, code: 'token_required' },
    );
  });

  it('rejects an expired token', async () => {
    const token = await mintToken({ expiresIn: '-10s' });

    await expect(authenticateMcpRequest(requestWith(token))).rejects.toMatchObject(
      { status: 401, code: 'invalid_token' },
    );
  });

  it('rejects a wrong issuer', async () => {
    const token = await mintToken({ issuer: 'https://evil.example.com' });

    await expect(authenticateMcpRequest(requestWith(token))).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('rejects a wrong audience', async () => {
    const token = await mintToken({ audience: 'https://other-resource' });

    await expect(authenticateMcpRequest(requestWith(token))).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('rejects a token whose subject does not match the connection', async () => {
    const token = await mintToken({ subject: 'someone-else' });

    await expect(authenticateMcpRequest(requestWith(token))).rejects.toMatchObject(
      { status: 401, code: 'connection_revoked' },
    );
  });

  it('rejects a revoked connection even with an unexpired token', async () => {
    connectionRow.revokedAt = new Date();
    const token = await mintToken();

    await expect(authenticateMcpRequest(requestWith(token))).rejects.toMatchObject(
      { status: 401, code: 'connection_revoked' },
    );
  });

  it('rejects tokens missing the grant identifier', async () => {
    const token = await new SignJWT({
      scope: 'secondbrain:read secondbrain:write',
      client_id: 'client-1',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(SECRET);

    await expect(authenticateMcpRequest(requestWith(token))).rejects.toMatchObject(
      { status: 401, code: 'invalid_token' },
    );
  });

  it('rejects a token whose grant resolves to no connection', async () => {
    grantLookupEmpty = true;
    try {
      const token = await mintToken({ grantId: 'unknown-grant' });

      await expect(
        authenticateMcpRequest(requestWith(token)),
      ).rejects.toMatchObject({ status: 401, code: 'connection_revoked' });
    } finally {
      grantLookupEmpty = false;
    }
  });

  it('requireScopes throws insufficient_scope listing the missing scope', () => {
    const context = {
      userId: 'user-1',
      connectionId: 'conn-1',
      clientId: 'client-1',
      grantId: 'grant-1',
      issuer: ISSUER,
      scopes: ['secondbrain:read'],
    };

    expect(() => requireScopes(context, ['secondbrain:read'])).not.toThrow();
    expect(() => requireScopes(context, ['secondbrain:write'])).toThrowError(
      McpAuthError,
    );

    try {
      requireScopes(context, ['secondbrain:write']);
    } catch (error) {
      expect((error as McpAuthErrorType).status).toBe(403);
      expect((error as McpAuthErrorType).scope).toBe('secondbrain:write');
    }
  });

  it('sha256Hex matches node crypto output', async () => {
    const { createHash } = await import('node:crypto');

    expect(sha256Hex('abc')).toBe(
      createHash('sha256').update('abc').digest('hex'),
    );
  });

  it('rejects users not on the MCP_ENABLED_USERS allowlist when set', async () => {
    process.env.MCP_ENABLED_USERS = 'someone-else,another-user';
    try {
      const token = await mintToken();

      await expect(
        authenticateMcpRequest(requestWith(token)),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      delete process.env.MCP_ENABLED_USERS;
    }
  });

  it('allows users on the MCP_ENABLED_USERS allowlist', async () => {
    process.env.MCP_ENABLED_USERS = ' someone-else , user-1 ';
    try {
      const token = await mintToken();
      const context = await authenticateMcpRequest(requestWith(token));

      expect(context.userId).toBe('user-1');
    } finally {
      delete process.env.MCP_ENABLED_USERS;
    }
  });

  it('allows everyone when MCP_ENABLED_USERS is unset or empty', async () => {
    delete process.env.MCP_ENABLED_USERS;
    const token = await mintToken();

    await expect(
      authenticateMcpRequest(requestWith(token)),
    ).resolves.toMatchObject({ userId: 'user-1' });

    process.env.MCP_ENABLED_USERS = '';
    try {
      const token2 = await mintToken();

      await expect(
        authenticateMcpRequest(requestWith(token2)),
      ).resolves.toMatchObject({ userId: 'user-1' });
    } finally {
      delete process.env.MCP_ENABLED_USERS;
    }
  });
});
