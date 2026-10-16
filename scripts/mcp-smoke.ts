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
  return response.status;
}
export {};

const noAuth = await post();
if (noAuth !== 401) throw new Error('expected 401 without token');
console.log('no-token: rejected');

const bad = await post('sb_mcp_smoke-test-invalid-key');
if (bad !== 401) throw new Error('expected 401 for unknown key');
console.log('unknown key: rejected');

const notKey = await post('not-a-jwt-and-not-a-key');
if (notKey !== 401) throw new Error('expected 401 for garbage token');
console.log('garbage: rejected');

console.log('smoke OK: auth boundary rejects unauthenticated and unknown-key requests');
