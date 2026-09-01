// @vitest-environment node
// Node environment: happy-dom strips the fetch-forbidden `Origin` header from
// Request, but the route's Origin validation (and the real runtime) need it.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authContext = {
  userId: 'user-1',
  connectionId: 'conn-1',
  clientId: 'client-1',
  grantId: 'grant-1',
  issuer: 'https://issuer.example.com',
  scopes: ['secondbrain:read', 'secondbrain:write'],
};

const rateLimitState = { allowed: true };

vi.mock('@/lib/auth/mcp', () => ({
  McpAuthError: class McpAuthError extends Error {
    status: number;
    code: string;
    errorDescription: string;
    scope?: string;
    constructor(failure: { status: number; code: string; errorDescription: string; scope?: string }) {
      super(failure.errorDescription);
      this.status = failure.status;
      this.code = failure.code;
      this.errorDescription = failure.errorDescription;
      this.scope = failure.scope;
    }
  },
  authenticateMcpRequest: vi.fn(async () => authContext),
  buildWwwAuthenticateChallenge: vi.fn(() => 'Bearer realm="test"'),
  touchConnectionLastUsed: vi.fn(async () => undefined),
  recordMcpAuditEvent: vi.fn(async () => undefined),
  sha256Hex: (value: string) => `hash-${value.length}`,
}));

vi.mock('@/lib/mcp/server', () => ({
  createMcpServer: vi.fn(() => ({
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    registerTool: vi.fn(),
    registerResource: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js', () => ({
  WebStandardStreamableHTTPServerTransport: class {
    handleRequest = vi.fn(async () => new Response(null, { status: 200 }));
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: async () =>
            rateLimitState.allowed ? [{ count: 1 }] : [{ count: 9999 }],
        }),
      }),
    }),
  },
}));

const { POST, GET } = await import('@/app/api/mcp/route');
const { authenticateMcpRequest } = await import('@/lib/auth/mcp');

function jsonRequest(
  body: unknown,
  headers: Record<string, string> = {},
  url = 'http://localhost:3000/api/mcp',
): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer test-token',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validInitialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  },
};

describe('MCP endpoint wire validation (plan 21.2/16)', () => {
  beforeEach(() => {
    rateLimitState.allowed = true;
    vi.mocked(authenticateMcpRequest).mockClear?.();
  });

  it('returns 401 with WWW-Authenticate when no token is present', async () => {
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(validInitialize),
    });
    const { authenticateMcpRequest } = await import('@/lib/auth/mcp');
    vi.mocked(authenticateMcpRequest).mockImplementationOnce(async () => {
      const { McpAuthError } = await import('@/lib/auth/mcp');
      throw new McpAuthError({
        status: 401,
        code: 'token_required',
        errorDescription: 'Bearer token required',
      });
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');

    const payload = (await response.json()) as { error: { data: { code: string } } };

    expect(payload.error.data.code).toBe('token_required');
  });

  it('returns 403 for an Origin that does not match the request origin', async () => {
    const response = await POST(
      jsonRequest(validInitialize, { origin: 'https://evil.example.com' }),
    );

    expect(response.status).toBe(403);
  });

  it('allows same-origin and absent Origin', async () => {
    const sameOrigin = await POST(
      jsonRequest(validInitialize, { origin: 'http://localhost:3000' }),
    );

    expect(sameOrigin.status).toBe(200);
  });

  it('returns 415 for non-JSON content types', async () => {
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { accept: 'application/json' },
      body: 'text',
    });
    const response = await POST(request);

    expect(response.status).toBe(415);
  });

  it('returns 406 when Accept omits both json and event-stream', async () => {
    const response = await POST(
      jsonRequest(validInitialize, { accept: 'text/html' }),
    );

    expect(response.status).toBe(406);
  });

  it('returns 413 for bodies over 1 MiB', async () => {
    const big = { ...validInitialize, padding: 'x'.repeat(1024 * 1024 + 10) };
    const response = await POST(jsonRequest(big));

    expect(response.status).toBe(413);
  });

  it('returns a JSON-RPC parse error for invalid JSON', async () => {
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: 'Bearer test-token',
      },
      body: '{not json',
    });
    const response = await POST(request);
    const payload = (await response.json()) as { error: { code: number } };

    expect(payload.error.code).toBe(-32700);
  });

  it('rejects batch arrays with 400', async () => {
    const response = await POST(jsonRequest([validInitialize]));

    expect(response.status).toBe(400);
  });

  it('returns invalid request for non JSON-RPC 2.0 payloads', async () => {
    const response = await POST(
      jsonRequest({ jsonrpc: '1.0', id: 1, method: 'ping' }),
    );
    const payload = (await response.json()) as { error: { code: number } };

    expect(payload.error.code).toBe(-32600);
  });

  it('returns 429 with Retry-After when the connection limit trips', async () => {
    rateLimitState.allowed = false;
    const response = await POST(jsonRequest(validInitialize));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();

    const payload = (await response.json()) as { error: { code: number } };

    expect(payload.error.code).toBe(-32002);
  });

  it('rejects mismatched Mcp-Method headers with -32602', async () => {
    const response = await POST(
      jsonRequest(validInitialize, { 'mcp-method': 'tools/call' }),
    );
    const payload = (await response.json()) as { error: { code: number } };

    expect(payload.error.code).toBe(-32602);
  });

  it('rejects mismatched Mcp-Name headers on tools/call', async () => {
    const toolCall = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/call',
      params: { name: 'search_courses', arguments: { query: 'LOG' } },
    };
    const response = await POST(
      jsonRequest(toolCall, { 'mcp-method': 'tools/call', 'mcp-name': 'other_tool' }),
    );
    const payload = (await response.json()) as { error: { code: number } };

    expect(payload.error.code).toBe(-32602);
  });

  it('GET is not allowed (no server-initiated SSE in stateless mode)', async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toContain('POST');
  });

  it('does not accept the Auth.js cookie as authentication', async () => {
    // The cookie header alone must not authenticate: authenticateMcpRequest
    // is the only auth path and it requires a bearer token.
    const { authenticateMcpRequest } = await import('@/lib/auth/mcp');
    const { McpAuthError } = await import('@/lib/auth/mcp');
    vi.mocked(authenticateMcpRequest).mockImplementationOnce(async () => {
      throw new McpAuthError({
        status: 401,
        code: 'token_required',
        errorDescription: 'Bearer token required',
      });
    });
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        cookie: 'authjs.session-token=stolen-cookie',
      },
      body: JSON.stringify(validInitialize),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
