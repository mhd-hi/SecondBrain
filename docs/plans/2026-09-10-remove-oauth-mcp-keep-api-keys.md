# Plan: Remove the OAuth/dev-token MCP auth path, keep MCP API keys as the single implementation

Date: 2026-09-10
Status: Approved for implementation (pending final review)
Scope: Pure deletion of the legacy OAuth bearer-token path and the staged-rollout allowlist. The MCP API key path becomes the only MCP authentication implementation. No new features, no schema migration.

## 1. Problem statement

The MCP endpoint (`/api/mcp`) currently contains two authentication implementations inside one boundary function. One of them (OAuth JWT) is the reason MCP was effectively "local only": it can only ever authenticate tokens minted by a dev issuer that does not exist in this repository. The product decision is:

- Users connect MCP clients (Claude, ChatGPT, OpenCode, etc.) remotely using **MCP API keys** created in **Preferences > MCP & AI Clients**.
- There is exactly **one** MCP auth implementation (the API key path).
- MCP is not privatized: no allowlist gating who may create keys or connect.

## 2. Verified findings (all file:line checked against working tree)

### 2.1 The two auth implementations

`src/lib/auth/mcp.ts` — `authenticateMcpRequest` (line 232) branches on token shape:

- **API key path (KEEP)** — tokens starting with `sb_mcp_` (line 244) go to `authenticateApiKey` (line 334). Sha256-hash lookup in `mcp_connections`, timing-safe compare, immediate revocation, scope enforcement. This is the *only* path that can currently succeed in practice, and it is already fully remote-capable.
- **OAuth JWT path (DELETE)** — everything else goes to `verifyTokenStructure` (line 142). Requires env vars `MCP_OAUTH_ISSUER`, `MCP_OAUTH_AUDIENCE`, and either `MCP_OAUTH_JWKS_URI` or `MCP_OAUTH_SECRET`.

### 2.2 The OAuth path is dead code

Evidence:

- `.env` line 32–34 sets `MCP_DEV_TOKEN_SECRET`, `MCP_OAUTH_ISSUER="http://localhost:3005/dev-issuer"`, `MCP_OAUTH_AUDIENCE="second-brain-mcp"`. The comment on line 31 says "Remote MCP dev smoke-test config (local only)".
- **No dev issuer exists in this repo.** A repo-wide search for `dev-issuer` and `MCP_DEV_TOKEN` in `src/` returns nothing. Port 3005 / `/dev-issuer` was an external dev-only token minting process. Without it (and without a real production authorization server), `verifyTokenStructure` always throws `invalid_token`.
- **No code path ever creates a real OAuth connection row.** The only `insert(mcpConnections)` site is `src/app/api/mcp/api-keys/route.ts:67`, which writes sentinel values (`oauthIssuer: 'local'`, `oauthClientId: 'api-key'`, `oauthGrantId: 'api-key:<uuid>'`). So even a valid JWT could never resolve to a connection row — the grant lookup at `src/lib/auth/mcp.ts:255-265` would fail with `connection_revoked`.
- `MCP_DEV_TOKEN_SECRET` is declared in `.env` and in **stale** `.next` build chunks only. Current `src/env.js` does not declare it (it was removed from the schema at some point; the `.env` entry is leftover).

### 2.3 The allowlist (`MCP_ENABLED_USERS`) is obsolete rollout scaffolding

- Defined in `src/lib/auth/mcp.ts:302-318` (`isUserMcpEnabled`, `assertUserAllowed`). Comment says "Staged rollout allowlist (plan section 20, Phase 6 / section 22.1 private alpha)".
- Consumed in three places: the OAuth branch (`mcp.ts:286`), the API key branch (`mcp.ts:364`), and key creation (`src/app/api/mcp/api-keys/route.ts:41`).
- Declared in `src/env.js:31` and `src/env.js:74`; documented in `.env.example:40`; tested in `tests/unit/mcp-auth.test.ts` (5 tests).
- Per product decision, MCP is open to all signed-in users. Unset/empty already means open; we delete the mechanism entirely rather than leave dead config.

### 2.4 Everything else in the MCP surface is API-key-based and stays untouched

Verified consumers of `@/lib/auth/mcp` exports that are unaffected:

- `src/app/api/mcp/route.ts` — imports `authenticateMcpRequest`, `buildWwwAuthenticateChallenge`, `McpAuthError`, `touchConnectionLastUsed`. All keep working.
- `src/app/api/mcp/api-keys/route.ts` — imports `MCP_API_KEY_PREFIX`, `MCP_SCOPES`, `sha256Hex` (keep), `isUserMcpEnabled` (delete usage).
- `src/lib/mcp/server.ts`, `src/lib/mcp/task-tools.ts`, `src/lib/mcp/course-tools.ts` — import `McpAuthContext`, `requireScopes`, `sha256Hex`. Untouched.
- `src/lib/mcp/approval.ts`, `src/lib/ai/chat/executor.ts` — import `sha256Hex`, `recordMcpAuditEvent`. Untouched.
- `src/app/api/mcp/connections/route.ts` — list/revoke. Untouched.
- `src/components/Preferences/McpTab.tsx` — UI mentions only API keys and the server URL. No OAuth wording. Untouched.
- `scripts/mcp-smoke.ts` — already tests the API-key boundary (`sb_mcp_` tokens). Untouched.
- Tests: `tests/unit/mcp-route.test.ts` (mocks `buildWwwAuthenticateChallenge`), `tests/unit/mcp-tools.test.ts`, `tests/unit/mcp-review-app.test.ts`, `tests/unit/mcp-redact.test.ts`, `tests/unit/mcp-approval.test.ts`, `tests/unit/mcp-course-tools.test.ts`, `tests/integration/mcp-tenant-isolation.test.ts`, `tests/integration/mcp-draft-approval.test.ts`, `tests/integration/course-draft-approval.test.ts`. None reference OAuth env vars. Untouched.

### 2.5 Dead references found during review

- `docs/mcp.md:7` links to `docs/mcp-adr.md` — **that file does not exist** (only `docs/mcp.md` is in `docs/`). Remove the link.
- `src/lib/auth/mcp.ts:431` comment references `docs/mcp-adr.md` — same fix (comment is rewritten anyway).
- `MCP_RESOURCE_AUDIENCE` (`src/lib/auth/mcp.ts:26`) — exported, **zero consumers** anywhere in `src/` or `tests/` (audience only mattered for JWT verification). Delete.

## 3. Exact changes

### 3.1 `src/lib/auth/mcp.ts` (rewrite to API-key-only)

Delete:

- `import { createRemoteJWKSet, jwtVerify } from 'jose'` (line 4)
- Type `TokenClaims` (lines 99-108), `VerifiedToken` (lines 131-140), `claimString` (110-113)
- `requiredEnv` (lines 87-97) — only used by `verifyTokenStructure`
- `verifyTokenStructure` (lines 142-207)
- OAuth branch in `authenticateMcpRequest` (lines 248-295): JWT verification, connection lookup by `(oauthGrantId, oauthIssuer)`, claim-mismatch checks
- `MCP_RESOURCE_AUDIENCE` (line 26)
- `isUserMcpEnabled` (302-308) and `assertUserAllowed` (310-318)
- The allowlist check inside `authenticateApiKey` (lines 364-371)
- `'connection_mismatch'` from the `McpAuthFailure` code union (line 53) — never used anywhere, and was reserved for the OAuth claim-mismatch path

Keep (all still consumed):

- `MCP_SCOPES`, `McpScope`, `MCP_API_KEY_PREFIX`, `McpAuthContext`, `McpAuthError`, `McpAuthFailure` (minus `connection_mismatch`)
- `sha256Hex`, `timingSafeEqualStr`, `buildWwwAuthenticateChallenge` (RFC 6750/MCP challenge header, mocked by `mcp-route.test.ts`, parsed by clients)
- `extractBearerToken`, `authenticateApiKey` (minus allowlist check), `requireScopes`, `touchConnectionLastUsed`, `recordMcpAuditEvent`
- Timing-attack padding calls in the failure paths of `authenticateApiKey` (lines 349, 357) — keep; they are the documented latency-uniformity mechanism

Rewrite the file-level doc comment (lines 8-21): the boundary authenticates with a static API key (`sb_mcp_` prefix), resolves to one active non-revoked `mcp_connections` row, identity comes from the key's row, never from tool input. Drop all "authorization server / audience / grant / provider selection" wording and the `docs/mcp-adr.md` mention.

Resulting shape of `authenticateMcpRequest`: extract bearer → if missing, `token_required`; if not `sb_mcp_` prefixed, `invalid_token` ("Unknown API key" — see 3.6); else hash lookup + revoked check → return context.

### 3.2 `src/app/api/mcp/api-keys/route.ts`

- Remove `isUserMcpEnabled` from the import (line 7) and the 403 check (lines 41-46). Any signed-in user can create keys.

### 3.3 Delete `src/app/.well-known/oauth-protected-resource/route.ts` (entire file)

Only served OAuth discovery (RFC 9728). With no OAuth, there is nothing to discover; API-key clients send a static `Authorization: Bearer sb_mcp_...` header and never perform discovery. Deleting it removes a route whose only non-OAuth behavior is a 503.

Note: `src/app/api/mcp/route.ts:31` (`RESOURCE_METADATA_PATH`) still feeds `resource_metadata=` into the `WWW-Authenticate` challenge via `buildWwwAuthenticateChallenge`. **Keep this as-is.** The header shape is RFC-compliant, a client that doesn't need OAuth never fetches the URL, and changing the signature would touch `mcp-route.test.ts` for zero benefit. A URL that 404s inside a challenge header is harmless.

### 3.4 `src/env.js`

- Delete lines 27-31 (server schema: `MCP_OAUTH_ISSUER`, `MCP_OAUTH_AUDIENCE`, `MCP_OAUTH_JWKS_URI`, `MCP_OAUTH_SECRET`, `MCP_ENABLED_USERS`)
- Delete lines 70-74 (runtime mappings, same five keys)

### 3.5 Env files

- `.env`: delete lines 31-34 (comment + `MCP_DEV_TOKEN_SECRET`, `MCP_OAUTH_ISSUER`, `MCP_OAUTH_AUDIENCE`). Leave `MCP_DEV_TOKEN_SECRET` unset everywhere — nothing reads it.
- `.env.example`: delete lines 34-37 (`MCP_OAUTH_*`) and line 40 (`MCP_ENABLED_USERS`). (Cannot read `.env` directly during implementation due to local permission rules — apply the deletion by line count from this plan, or ask the user to confirm the block.)

### 3.6 Behavior change to document: non-`sb_mcp_` bearer tokens

Today a random JWT gets JWT-specific errors (`invalid_token` from signature verification, etc.). After deletion, any non-`sb_mcp_` token falls through to the API-key lookup and fails with `invalid_token` / "Unknown API key". This is correct (fail closed) and simpler. `tests/unit/mcp-auth.test.ts` must reflect it (see 3.7).

### 3.7 `tests/unit/mcp-auth.test.ts`

- Delete `import { SignJWT } from 'jose'` (line 1), the `mintToken` helper (lines 51-83), `ISSUER`/`AUDIENCE`/`SECRET` constants (47-49), and the entire `describe('MCP token boundary (plan 21.1)')` block (lines 93-271).
- Delete the allowlist test in the API-key block (`enforces the MCP_ENABLED_USERS allowlist for API keys`, lines 314-323) and the `delete process.env.MCP_ENABLED_USERS` in its `beforeEach` (line 281).
- Add one test to the API-key block: a non-`sb_mcp_` bearer token (e.g. `Bearer eyJhbGciOi...`) rejects with `{ status: 401, code: 'invalid_token' }` — pinning the 3.6 behavior.
- Keep: valid-key auth, unknown key, revoked key, read-only scope rejection, `requireScopes`, `sha256Hex`. The mocked `db.select().from().where().limit()` mock still fits (single lookup shape now).

### 3.8 `docs/mcp.md`

- Line 7: remove the dead `docs/mcp-adr.md` link.
- Nothing else: the doc already documents only API keys. (No OAuth wording exists in it.)

### 3.9 Explicitly NOT changed (with reasons)

- **DB schema** (`src/server/db/schema.ts:139-164`): the `oauth_issuer`/`oauth_subject`/`oauth_client_id`/`oauth_grant_id` columns and the unique index `uq_mcp_connections_oauth_grant` stay. The API-key path writes sentinel values into them (`api-keys/route.ts:70-73`), and `oauth_grant_id` is part of a unique index plus `clientName` default in migrations `0030-0033`. Dropping them = a drizzle migration + snapshot churn for zero behavior change. If schema cleanliness is wanted later, do it as its own migration PR.
- **`McpAuthContext.issuer` / `.grantId` / `.clientId`**: still populated with sentinels (`'local'`, `'api-key'`, `'api-key:<id>'`). The audit table and rate-limit keys use `connectionId`/`userId`, but `grantId`/`clientId` flow into `authInfo` passed to the transport (`mcp/route.ts:303-309`). Renaming sentinels is churn; keep.
- **`buildWwwAuthenticateChallenge` and the `WWW-Authenticate` header**: keep (see 3.3 note).
- **Rate limits, audit events, draft/approval machinery, MCP Apps review card, review web page, smoke script, Preferences UI**: all orthogonal, all untouched.

## 4. Implementation order

1. `src/lib/auth/mcp.ts` rewrite (3.1)
2. `src/app/api/mcp/api-keys/route.ts` (3.2)
3. Delete `.well-known` route file (3.3)
4. `src/env.js` (3.4)
5. `.env` / `.env.example` (3.5)
6. `tests/unit/mcp-auth.test.ts` (3.7)
7. `docs/mcp.md` (3.8)

## 5. Verification checklist

Run (exact commands per repo tooling — package.json uses `bun` and `vitest`):

- `bunx tsc --noEmit` (or the repo's typecheck script) — proves no dangling imports of deleted symbols (`jose`, `MCP_RESOURCE_AUDIENCE`, `isUserMcpEnabled`, `MCP_OAUTH_*`)
- `bun run test tests/unit/mcp-auth.test.ts tests/unit/mcp-route.test.ts`
- Full test suite: `bun run test`
- `bun run scripts/mcp-smoke.ts` against a dev server (optional, manual): unauthenticated and unknown-key requests still rejected
- Grep zero-hit gate before commit:
  - `MCP_OAUTH_`, `MCP_DEV_TOKEN`, `MCP_ENABLED_USERS`, `MCP_RESOURCE_AUDIENCE`, `dev-issuer` in `src/`, `tests/`, `.env.example`
  - `jwtVerify`, `createRemoteJWKSet`, `from 'jose'` in `src/lib/auth/mcp.ts`
- Manual smoke: start dev server, create an API key in Preferences, call `/api/mcp` remotely with `Authorization: Bearer sb_mcp_...` → `tools/list` succeeds; revoke key → next call 401 `connection_revoked`

## 6. Risks and mitigations

| Risk | Assessment | Mitigation |
| --- | --- | --- |
| Existing deployed key/connection rows break | None — they are API-key rows already; lookup path unchanged | None needed |
| A client was somehow using OAuth JWTs | Impossible per 2.2: no issuer existed to mint them, and no connection rows exist to resolve | None needed |
| Someone still wants provider-OAuth later | Out of scope by product decision; the sentinel `oauth_*` columns keep schema compatible if a provider is ever added | Schema intentionally kept (3.9) |
| `.env` edit on a permission-locked file | Plan pins exact lines 31-34 | Edit by line numbers or ask user to confirm |
| Stale `.next/` build artifacts still contain old code | Build output, not source | Ignore; next build regenerates |

## 7. Net effect

Roughly **-280 source/test lines, +6** (one new test, one doc line removed). One auth implementation (`authenticateApiKey`), reachable from any network, no local-only config, no allowlist.
