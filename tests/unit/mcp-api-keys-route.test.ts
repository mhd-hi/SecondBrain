// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  insertReturning: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    transaction: mocks.transaction,
  },
}));
vi.mock('@/server/db/schema', () => ({ mcpConnections: {} }));
vi.mock('@/lib/auth/api', () => ({
  withAuthSimple: (handler: unknown) => handler,
}));

const { POST } = await import('@/app/api/mcp/api-keys/route');
const { DELETE: revokeConnection } = await import(
  '@/app/api/mcp/connections/route'
);

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/mcp/api-keys', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      ...headers,
    },
    body,
  });
}

describe('MCP API key creation boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback({
      execute: vi.fn(),
      select: () => ({ from: () => ({ where: async () => [{ value: 0 }] }) }),
      insert: () => ({
        values: () => ({ returning: mocks.insertReturning }),
      }),
    }));
    mocks.insertReturning.mockResolvedValue([{ id: 'key-id', keyPrefix: 'sb_mcp_secret' }]);
  });

  it('rejects cross-origin requests before creating a key', async () => {
    const response = await POST(
      request('{"label":"attacker"}', { origin: 'https://evil.example' }) as never,
      { user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('validates JSON shape and content type', async () => {
    const malformed = await POST(
      request('null') as never,
      { user: { id: 'user-1' } } as never,
    );
    const wrongType = await POST(
      request('{"label":"test"}', { 'content-type': 'text/plain' }) as never,
      { user: { id: 'user-1' } } as never,
    );

    expect(malformed.status).toBe(400);
    expect(wrongType.status).toBe(415);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('marks one-time API-key responses non-cacheable', async () => {
    const response = await POST(
      request('{"label":"test"}') as never,
      { user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, private');
  });

  it('rejects malformed connection IDs before querying the database', async () => {
    const response = await revokeConnection(
      new Request('http://localhost:3000/api/mcp/connections?id=not-a-uuid', {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3000' },
      }) as never,
      { user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(400);
  });
});
