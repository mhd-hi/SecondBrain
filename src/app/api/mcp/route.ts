import { sql } from 'drizzle-orm';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { db } from '@/server/db';
import { mcpRateLimits } from '@/server/db/schema';
import {
  authenticateMcpRequest,
  buildWwwAuthenticateChallenge,
  McpAuthError,
  touchConnectionLastUsed,
} from '@/lib/auth/mcp';
import { createMcpServer } from '@/lib/mcp/server';

/**
 * Remote MCP endpoint (plan section 16).
 *
 * Stateless Streamable HTTP: one transport + one McpServer per request, no
 * protocol-session persistence. Every request authenticates independently;
 * the Auth.js browser cookie is never consulted. Wire limits, Origin
 * validation, and durable rate limits are enforced before the MCP stack
 * runs.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

const CONNECTION_LIMIT = { windowMs: 60_000, max: 60 };
const USER_LIMIT = { windowMs: 600_000, max: 300 };

const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      id,
      error: { code, message, ...(data ? { data } : {}) },
    },
    { status: 200 },
  );
}

function httpError(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

async function readBodyWithLimit(
  request: Request,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return { ok: false };
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) {
    return { ok: false };
  }
  return { ok: true, text: new TextDecoder().decode(buffer) };
}

function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true; // non-browser clients legitimately omit Origin
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function checkRateLimit(
  key: string,
  windowMs: number,
  max: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowStartedAt = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStartedAt.getTime() + windowMs);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - now) / 1000),
  );

  // Increment only while under the cap: rejected requests do not extend
  // their own lockout, they just wait for the fixed window to reset.
  const rows = await db
    .insert(mcpRateLimits)
    .values({ key, windowStartedAt, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: [mcpRateLimits.key, mcpRateLimits.windowStartedAt],
      set: { count: sql`${mcpRateLimits.count} + 1` },
      setWhere: sql`${mcpRateLimits.count} < ${max}`,
    })
    .returning({ count: mcpRateLimits.count });
  // No row returned means the conflict row was already at/over the cap.
  const count = rows[0]?.count;
  return {
    allowed: count !== undefined && count <= max,
    retryAfterSeconds,
  };
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;

function extractId(body: unknown): JsonRpcId {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const id = (body as JsonRpcRequest).id;
  if (typeof id === 'string' || typeof id === 'number' || id === null) {
    return id;
  }
  return null;
}

function authErrorResponse(
  request: Request,
  parsedId: JsonRpcId,
  error: McpAuthError,
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: parsedId,
      error: {
        code: -32001,
        message: error.errorDescription,
        data: { code: error.code },
      },
    }),
    {
      status: error.status,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': buildWwwAuthenticateChallenge({
          status: error.status,
          code: error.code,
          errorDescription: error.errorDescription,
          scope: error.scope,
          resourceMetadataUrl: new URL(
            RESOURCE_METADATA_PATH,
            request.url,
          ).toString(),
        }),
      },
    },
  );
}

function rateLimitResponse(parsedId: JsonRpcId, retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: parsedId,
      error: { code: -32002, message: 'Rate limit exceeded' },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}

async function handlePost(request: Request): Promise<Response> {
  // --- Wire validation before any MCP processing ---
  if (!validateOrigin(request)) {
    return httpError(403);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return httpError(415);
  }

  const accept = request.headers.get('accept') ?? '';
  if (
    !accept.includes('application/json') &&
    !accept.includes('text/event-stream')
  ) {
    return httpError(406);
  }

  const bodyResult = await readBodyWithLimit(request);
  if (!bodyResult.ok) {
    return httpError(413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyResult.text);
  } catch {
    return jsonRpcError(null, PARSE_ERROR, 'Invalid JSON');
  }

  if (Array.isArray(parsed)) {
    return httpError(400);
  }

  const message = parsed as JsonRpcRequest;
  if (
    !message ||
    message.jsonrpc !== '2.0' ||
    typeof message.method !== 'string'
  ) {
    return jsonRpcError(
      extractId(parsed),
      INVALID_REQUEST,
      'Invalid JSON-RPC request',
    );
  }
  const parsedId = extractId(parsed);

  // Authentication before protocol dispatch; browser cookies are never
  // consulted (plan section 16).
  let auth;
  try {
    auth = await authenticateMcpRequest(request);
  } catch (error) {
    if (error instanceof McpAuthError) {
      return authErrorResponse(request, parsedId, error);
    }
    throw error;
  }

  // Per-connection and per-user durable limits (plan section 16).
  const connectionLimit = await checkRateLimit(
    `conn:${auth.connectionId}`,
    CONNECTION_LIMIT.windowMs,
    CONNECTION_LIMIT.max,
  );
  if (!connectionLimit.allowed) {
    return rateLimitResponse(parsedId, connectionLimit.retryAfterSeconds);
  }
  const userLimit = await checkRateLimit(
    `user:${auth.userId}`,
    USER_LIMIT.windowMs,
    USER_LIMIT.max,
  );
  if (!userLimit.allowed) {
    return rateLimitResponse(parsedId, userLimit.retryAfterSeconds);
  }

  // Header metadata validation (plan 7.1 / 21.2).
  const headerProtocolVersion = request.headers.get('mcp-protocol-version');
  const bodyMeta = (
    message.params as { _meta?: Record<string, unknown> } | undefined
  )?._meta;
  const metaProtocolVersion = bodyMeta?.[
    'io.modelcontextprotocol/protocolVersion'
  ] as string | undefined;
  if (
    metaProtocolVersion &&
    headerProtocolVersion &&
    metaProtocolVersion !== headerProtocolVersion
  ) {
    return jsonRpcError(
      parsedId,
      -32602,
      'Protocol version mismatch between header and request metadata',
    );
  }
  const mcpMethod = request.headers.get('mcp-method');
  if (mcpMethod && mcpMethod !== message.method) {
    return jsonRpcError(parsedId, -32602, 'Mcp-Method header mismatch');
  }
  if (mcpMethod === 'tools/call') {
    const mcpName = request.headers.get('mcp-name');
    const toolName = (message.params as { name?: string } | undefined)?.name;
    if (mcpName && mcpName !== toolName) {
      return jsonRpcError(parsedId, -32602, 'Mcp-Name header mismatch');
    }
  }

  // Fresh transport + server per request: stateless by construction.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer(auth);
  await server.connect(transport);

  try {
    const response = await transport.handleRequest(request, {
      authInfo: {
        token: '',
        clientId: auth.clientId,
        scopes: auth.scopes,
      },
      parsedBody: parsed as never,
    });
    void touchConnectionLastUsed(auth.connectionId, auth.apiKey === true).catch(() => {});
    return response;
  } catch (error) {
    await server.close().catch(() => {});
    throw error;
  }
  // NOTE: the server/transport pair is intentionally not closed on the
  // success path: when the transport answers with a request-scoped SSE
  // stream, the response body is still streaming when this handler returns,
  // and closing here truncates it (client sees 'SSE stream ended without a
  // response'). The stateless transport holds no protocol-session state, so
  // the pair is garbage-collected once the response completes.
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await handlePost(request);
  } catch (error) {
    console.error(
      'MCP endpoint error',
      error instanceof Error ? error.message : error,
    );
    return httpError(500);
  }
}

export async function GET(): Promise<Response> {
  // Server-initiated SSE streams are not offered in the stateless first
  // release (plan section 7.1).
  return httpError(405, { Allow: 'POST, DELETE' });
}

export async function DELETE(): Promise<Response> {
  // Stateless mode has no session to terminate; acknowledge cleanup requests.
  return new Response(null, { status: 200 });
}
