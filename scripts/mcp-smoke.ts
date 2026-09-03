/**
 * Manual smoke test for the /api/mcp auth boundary (run against a dev server):
 *   bun run scripts/mcp-smoke.ts
 * Checks that requests without a token, with an unknown sb_mcp_ key, and with
 * a garbage token are all rejected with 401 before any protocol dispatch.
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3006';
const init = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '0' },
  },
};

async function post(token?: string) {
  const response = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(init),
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: response.status, body };
}

function code(result: { body: unknown }): string {
  const b = result.body as { error?: { data?: { error?: string }; message?: string } };
  return b?.error?.data?.error ?? b?.error?.message ?? JSON.stringify(result.body).slice(0, 120);
}

const noAuth = await post();
console.log(`no-token:    ${noAuth.status} ${code(noAuth)}`);
if (noAuth.status !== 401) throw new Error('expected 401 without token');

const bad = await post('sb_mcp_smoke-test-invalid-key');
console.log(`unknown key: ${bad.status} ${code(bad)}`);
if (bad.status !== 401) throw new Error('expected 401 for unknown key');

const notKey = await post('not-a-jwt-and-not-a-key');
console.log(`garbage:     ${notKey.status} ${code(notKey)}`);
if (notKey.status !== 401) throw new Error('expected 401 for garbage token');

console.log('smoke OK: auth boundary rejects unauthenticated and unknown-key requests');
