import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectionRow = {
  id: 'conn-1',
  userId: 'user-1',
  oauthIssuer: 'local',
  oauthSubject: 'user-1',
  oauthClientId: 'api-key',
  oauthGrantId: 'api-key:conn-1',
  keyHash: null as string | null,
  scopes: ['secondbrain:read', 'secondbrain:write'],
  revokedAt: null as Date | null,
};

// When true, the connection lookup resolves to no row (unknown key).
let grantLookupEmpty = false;

vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            if (grantLookupEmpty) {
              return [];
            }
            return [connectionRow];
          },
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
type McpAuthErrorType = import('@/lib/auth/mcp').McpAuthError;

function requestWith(token: string | null): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return new Request('http://localhost:3000/api/mcp', { headers });
}

describe('MCP API key boundary', () => {
  const KEY = 'sb_mcp_3knWq9tP2vXhF8mQeZ1rJcYbA7dUsKoLgNiMwTxE5Ra';

  beforeEach(() => {
    connectionRow.keyHash = sha256Hex(KEY);
    connectionRow.userId = 'user-1';
    connectionRow.scopes = ['secondbrain:read', 'secondbrain:write'];
    connectionRow.revokedAt = null;
    grantLookupEmpty = false;
  });

  it('authenticates a valid API key with the connection scopes', async () => {
    const context = await authenticateMcpRequest(requestWith(KEY));

    expect(context.userId).toBe('user-1');
    expect(context.connectionId).toBe('conn-1');
    expect(context.clientId).toBe('api-key');
    expect(context.issuer).toBe('local');
    expect(context.apiKey).toBe(true);
    expect(context.scopes).toContain('secondbrain:write');
  });

  it('rejects a missing bearer token', async () => {
    await expect(
      authenticateMcpRequest(requestWith(null)),
    ).rejects.toMatchObject({ status: 401, code: 'token_required' });
  });

  it('rejects a non-API-key bearer token as an unknown API key', async () => {
    await expect(
      authenticateMcpRequest(requestWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig')),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
  });

  it('rejects an unknown API key', async () => {
    grantLookupEmpty = true;
    try {
      await expect(
        authenticateMcpRequest(requestWith('sb_mcp_totally-unknown-key')),
      ).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    } finally {
      grantLookupEmpty = false;
    }
  });

  it('rejects a revoked API key', async () => {
    connectionRow.revokedAt = new Date();

    await expect(authenticateMcpRequest(requestWith(KEY))).rejects.toMatchObject(
      { status: 401, code: 'connection_revoked' },
    );
  });

  it('read-only key cannot pass requireScopes for write tools', async () => {
    connectionRow.scopes = ['secondbrain:read'];
    const context = await authenticateMcpRequest(requestWith(KEY));

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
});
