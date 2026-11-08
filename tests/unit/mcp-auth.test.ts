// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authWork = vi.hoisted(() => ({ scrypt: 0, lookups: 0 }));

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    scrypt: (...args: Parameters<typeof actual.scrypt>) => {
      authWork.scrypt += 1;
      return actual.scrypt(...args);
    },
  };
});

const connectionRow = {
  id: 'conn-1',
  userId: 'user-1',
  oauthIssuer: 'local',
  oauthSubject: 'user-1',
  oauthClientId: 'api-key',
  oauthGrantId: 'api-key:conn-1',
  keyPrefix: null as string | null,
  keyVerifier: null as string | null,
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
            authWork.lookups += 1;
            if (grantLookupEmpty) {
              return [];
            }
            return [{ ...connectionRow, scopes: [...connectionRow.scopes] }];
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

const {
  authenticateMcpRequest,
  requireScopes,
  McpAuthError,
  sha256Hex,
  hashSecret,
} = await import('@/lib/auth/mcp');
type McpAuthErrorType = import('@/lib/auth/mcp').McpAuthError;

function requestWith(token: string | null): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return new Request('http://localhost:3000/api/mcp', { headers });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MCP API key boundary', () => {
  const KEY = 'sb_mcp_3knWq9tP2vXhF8mQeZ1rJcYbA7dUsKoLgNiMwTxE5Ra';

  beforeEach(async () => {
    connectionRow.keyPrefix = KEY.slice(0, 16);
    connectionRow.keyVerifier = await hashSecret(KEY);
    connectionRow.id = 'conn-1';
    connectionRow.userId = 'user-1';
    authWork.scrypt = 0;
    authWork.lookups = 0;
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
      authenticateMcpRequest(
        requestWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig'),
      ),
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

    await expect(
      authenticateMcpRequest(requestWith(KEY)),
    ).rejects.toMatchObject({ status: 401, code: 'connection_revoked' });
  });

  it('rechecks revocation and scopes after a successful key verification', async () => {
    await authenticateMcpRequest(requestWith(KEY));

    connectionRow.scopes = ['secondbrain:read'];

    expect((await authenticateMcpRequest(requestWith(KEY))).scopes).toEqual([
      'secondbrain:read',
    ]);

    connectionRow.revokedAt = new Date();

    await expect(
      authenticateMcpRequest(requestWith(KEY)),
    ).rejects.toMatchObject({ status: 401, code: 'connection_revoked' });
  });

  it('rejects a valid prefix with the wrong secret', async () => {
    await expect(
      authenticateMcpRequest(
        requestWith(`${KEY.slice(0, 16)}wrong-secret-value`),
      ),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
  });

  it('fails closed when the row has no scrypt verifier (legacy/dev row)', async () => {
    connectionRow.keyVerifier = null;

    await expect(
      authenticateMcpRequest(requestWith(KEY)),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
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

  it('reuses successful verification but reads current identity and scopes', async () => {
    await authenticateMcpRequest(requestWith(KEY));

    expect(authWork.scrypt).toBe(1);

    connectionRow.userId = 'user-2';
    connectionRow.scopes = ['secondbrain:read'];

    expect(await authenticateMcpRequest(requestWith(KEY))).toMatchObject({
      userId: 'user-2',
      scopes: ['secondbrain:read'],
    });
    expect(authWork.scrypt).toBe(1);
    expect(authWork.lookups).toBe(2);
  });

  it('does not accept a cached key after its connection is deleted', async () => {
    await authenticateMcpRequest(requestWith(KEY));
    grantLookupEmpty = true;

    await expect(
      authenticateMcpRequest(requestWith(KEY)),
    ).rejects.toMatchObject({
      status: 401,
      code: 'invalid_token',
    });
  });

  it('invalidates verification when the stored verifier rotates', async () => {
    await authenticateMcpRequest(requestWith(KEY));
    const replacement = `${KEY.slice(0, 16)}rotated-secret`;
    connectionRow.keyVerifier = await hashSecret(replacement);

    await expect(
      authenticateMcpRequest(requestWith(KEY)),
    ).rejects.toMatchObject({
      status: 401,
      code: 'invalid_token',
    });
    expect(
      await authenticateMcpRequest(requestWith(replacement)),
    ).toMatchObject({
      connectionId: 'conn-1',
    });
  });

  it('requires verification again for a different connection row', async () => {
    await authenticateMcpRequest(requestWith(KEY));
    connectionRow.id = 'conn-2';

    expect(await authenticateMcpRequest(requestWith(KEY))).toMatchObject({
      connectionId: 'conn-2',
    });
    expect(authWork.scrypt).toBe(2);
  });

  it('fails closed if a cached verifier disappears or becomes malformed', async () => {
    await authenticateMcpRequest(requestWith(KEY));
    connectionRow.keyVerifier = 'invalid-verifier';

    await expect(
      authenticateMcpRequest(requestWith(KEY)),
    ).rejects.toMatchObject({
      status: 401,
      code: 'invalid_token',
    });

    connectionRow.keyVerifier = null;

    await expect(
      authenticateMcpRequest(requestWith(KEY)),
    ).rejects.toMatchObject({
      status: 401,
      code: 'invalid_token',
    });
  });

  it('re-verifies at the five-minute cache expiry boundary', async () => {
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await authenticateMcpRequest(requestWith(KEY));
    now += 5 * 60 * 1000 - 1;
    await authenticateMcpRequest(requestWith(KEY));

    expect(authWork.scrypt).toBe(1);

    now += 1;
    await authenticateMcpRequest(requestWith(KEY));

    expect(authWork.scrypt).toBe(2);
  });

  it('does not cache failed secret verification', async () => {
    const wrong = `${KEY.slice(0, 16)}incorrect-secret`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        authenticateMcpRequest(requestWith(wrong)),
      ).rejects.toMatchObject({
        status: 401,
        code: 'invalid_token',
      });
    }

    expect(authWork.scrypt).toBe(2);

    await authenticateMcpRequest(requestWith(KEY));

    expect(authWork.scrypt).toBe(3);
  });

  it.runIf(process.env.RUN_MCP_CPU_BENCHMARK === '1')(
    'reports local CPU for repeated authentication with fresh mocked database rows',
    async () => {
      let now = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      const iterations = 100;
      const samples = [];
      for (const mode of ['uncached', 'warm'] as const) {
        if (mode === 'warm') {
          await authenticateMcpRequest(requestWith(KEY));
        }
        const callsBefore = authWork.scrypt;
        const lookupsBefore = authWork.lookups;
        const cpuBefore = process.cpuUsage();
        const wallBefore = performance.now();
        for (let index = 0; index < iterations; index += 1) {
          if (mode === 'uncached') {
            now += 5 * 60 * 1000 + 1;
          }
          await authenticateMcpRequest(requestWith(KEY));
        }
        const cpu = process.cpuUsage(cpuBefore);
        const scryptCalls = authWork.scrypt - callsBefore;

        expect(scryptCalls).toBe(mode === 'uncached' ? iterations : 0);
        expect(authWork.lookups - lookupsBefore).toBe(iterations);

        samples.push({
          mode,
          iterations,
          scryptCalls,
          databaseLookups: authWork.lookups - lookupsBefore,
          cpuMs: (cpu.user + cpu.system) / 1000,
          wallMs: performance.now() - wallBefore,
        });
      }
      console.log(
        'MHI-47 local authentication CPU benchmark',
        JSON.stringify({
          node: process.version,
          database: 'mocked fresh row per request; no network',
          samples,
        }),
      );
    },
    60_000,
  );

  it('sha256Hex matches node crypto output', async () => {
    const { createHash } = await import('node:crypto');

    expect(sha256Hex('abc')).toBe(
      createHash('sha256').update('abc').digest('hex'),
    );
  });
});
