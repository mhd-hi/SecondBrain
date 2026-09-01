# ADR: Remote MCP Authentication and Protocol Baseline

Status: Accepted (Phase 0 decision record per MCP_IMPLEMENTATION_PLAN.md section 8.4)

Last updated: 2026-08-28

## Context

The MCP implementation plan requires an architecture decision record before
production write tools ship. It must fix the authorization-server issuer,
resource metadata URLs, token-validation strategy, client registration mode,
grant-identifier claim, and the exact wire responses. This document records
the decisions as implemented under `src/lib/mcp/` and `src/app/api/mcp/`.

## Decisions

### 1. Protocol revision and SDK

- Pinned: `@modelcontextprotocol/sdk@1.30.0`,
  `@modelcontextprotocol/ext-apps@1.7.5`.
- Negotiated protocol revision: `2025-11-25` (`LATEST_PROTOCOL_VERSION` of
  SDK 1.30.0). The plan's `2026-07-28` target is not yet implemented by any
  released SDK; section 7.1 forbids hand-rolling JSON-RPC when the SDK lacks
  the required behavior, so the latest SDK revision is the baseline. The
  revision-specific header-metadata checks (`MCP-Protocol-Version`,
  `Mcp-Method`, `Mcp-Name` mismatch) are enforced in the route with the
  revision-defined JSON-RPC error shape and will graduate to the newer
  revision's exact status codes when the SDK supports it.
- Transport: `WebStandardStreamableHTTPServerTransport` with
  `sessionIdGenerator: undefined` (stateless). One transport + one McpServer
  per request; no initialization or session persistence. After a
  request-scoped SSE response the pair is left for garbage collection (see
  the comment in `route.ts`); closing it before the stream drains truncates
  the response.

### 1b. Idempotency staging completed

- The additive sequence from plan section 10 is finished: migration `0030`
  added the namespaced `(user_id, request_namespace, request_id)` unique
  index alongside the legacy index; the chat draft path moved to the
  three-column conflict target and the `chat` namespace lookup; migration
  `0031` dropped the legacy `(user_id, request_id)` index once no code
  targeted it. The namespaced index is now the sole uniqueness arbiter,
  which also removed the dual-arbiter insert race the coexistence window
  caused.

### 2. Authorization server (production)

- The production authorization server is **not yet provisioned**. The
  resource side is complete and provider-agnostic behind
  `authenticateMcpRequest(request)` (plan section 8.4): every domain tool
  consumes only the validated `McpAuthContext`.
- Configuration (all via environment variables, documented in
  `.env.example`):
  - `MCP_OAUTH_ISSUER`: exact authorization-server issuer URL. Must equal
    the token `iss` claim. Exposed through
    `/.well-known/oauth-protected-resource` as `authorization_servers[0]`
    (RFC 9728).
  - `MCP_OAUTH_AUDIENCE`: exact MCP resource audience. Must equal the token
    `aud` claim. Recommended value: the canonical resource URI
    `https://<app-origin>/api/mcp` (the plan's audience-binding rule); the
    local default is `second-brain-mcp`.
  - `MCP_OAUTH_JWKS_URI`: remote JWKS for asymmetric tokens (preferred
    production mode; algorithms enforced by `jose` against the JWKS).
  - `MCP_OAUTH_SECRET`: symmetric-token secret (only if the chosen provider
    issues HS256; discouraged).
  - `MCP_DEV_TOKEN_SECRET`: development-only HS256 secret used by local
    smoke tests. Honored only when `NODE_ENV !== 'production'`.
- Validation on every request (section 21.1 coverage in
  `tests/unit/mcp-auth.test.ts`): signature, exact issuer, exact audience,
  exp/nbf with 5 s tolerance, `sub`, `client_id`, `grant_id`, `scope`,
  connection resolution by grant, revocation state, and stored-claim match
  (user, subject, client, issuer). Bearer tokens are accepted only from the
  `Authorization` header; the Auth.js session cookie is never consulted.

### 3. Grant identifier

- Required claim: `grant_id` (string). The plan requires one stable
  identifier per consented grant; a provider that cannot expose one in
  signed claims or introspection is ineligible for production writes. The
  connection row is keyed uniquely on `(oauth_issuer, oauth_grant_id)`
  (`uq_mcp_connections_issuer_grant`), and revocation is local and immediate
  (`mcp_connections.revoked_at`), independent of token expiry.
- When the production provider is selected, map its actual claim/introspection
  field to `grant_id` inside `authenticateMcpRequest` only; no other code
  changes.

### 3b. Staged rollout allowlist

- `MCP_ENABLED_USERS` (optional, comma-separated internal user IDs). When
  set, only those users may authenticate to `/api/mcp` (403 otherwise);
  unset/empty opens the surface to all authenticated users. This is the
  plan's section 20/22.1 staged-rollout control; tests cover all three
  modes in `tests/unit/mcp-auth.test.ts`.

### 4. Client registration and callbacks

- Not yet decided (blocked on provider provisioning): pre-registration vs
  Client ID Metadata Documents vs legacy Dynamic Client Registration. The
  resource side is registration-mode agnostic. ChatGPT and Claude callback
  allowlists must be recorded here after the Phase 0 spike against the real
  provider.

### 5. Challenge format

`WWW-Authenticate` on 401/403 (built by `buildWwwAuthenticateChallenge`):

```
Bearer realm="second-brain-mcp", error="<code>", error_description="<text>",
resource_metadata="<absolute URL of /.well-known/oauth-protected-resource>"[, scope="<missing scopes>"]
```

Codes: `token_required`, `invalid_token`, `connection_revoked` (401);
`insufficient_scope` (403, carries `scope`). Rate-limit rejections use `429`
with `Retry-After`.

### 6. MCP Apps negotiation

- Extension ID: `io.modelcontextprotocol/ui`, read from the current
  request's `_meta.extensions` (`extra._meta` in the tool handler) on every
  call. No process-local boolean, client-name heuristic, or prior request
  may enable capability issuance (plan 7.2).
- Clients that do not negotiate the extension (including the Python SDK
  client Hermes uses) receive the text review plus
  `https://<origin>/mcp/review/<draftId>` and never a capability. Verified
  end to end in `mcp-e2e` (fail-closed check).
- App-only tools (`commit_task_changes`, `reject_task_changes`) are
  registered with `_meta.ui.visibility: ['app']`. Server-side capability
  verification remains mandatory; visibility is model isolation, not
  authorization.

### 7. Idempotency canonicalization

- Canonical form: recursively key-sorted JSON serialization (stable across
  key reordering) over `{requestId, summary, reason, actions}`, implemented
  in `canonicalRequestHash` (`src/lib/mcp/approval.ts`). `requestId`
  participates: reusing a namespaced request ID with different input is an
  `IDEMPOTENCY_CONFLICT`, never a silent draft reuse. Covered by
  `tests/unit/mcp-approval.test.ts`.

### 8. Approval capability

- 32 cryptographically random bytes, base64url-encoded. Only the SHA-256
  hash is stored (`approval_capability_hash`), TTL 10 minutes, draft TTL
  24 hours unchanged. Render rotates (latest write wins). Consumption is
  part of the atomic claim predicate in `executor.ts`; a consumed
  capability authorizes receipt replay only.

### 9. Rate limits and limits

- Durable fixed-window limiter in `mcp_rate_limits` with composite PK
  `(key, window_started_at)` and atomic upsert: 60 req/min per connection,
  300 req/10 min per user. Keys are `conn:<connection-id>` and
  `user:<user-id>`; no token or client-controlled value enters the key.
- Request body limit 1 MiB (413). Origin header, when present, must match
  the request origin (403). GET is 405 (no server-initiated SSE in the
  stateless first release). DELETE acknowledges (no session to terminate).
- Infrastructure per-IP pre-auth limiting (plan section 16) is a hosting
  concern and must be configured at the edge when deployed; record the
  chosen Vercel/WAF control here.

## Evidence

- MCP-focused unit coverage: `mcp-approval.test.ts` (4), `mcp-auth.test.ts`
  (14), `mcp-route.test.ts` (14), `approve-reject-origin.test.ts` (8),
  `mcp-redact.test.ts` (7), `mcp-review-app.test.ts`, `mcp-tools.test.ts`,
  plus the assistant deep-link test. The complete unit suite passes with 352
  tests across 67 files.
- Integration: `tests/integration/mcp-draft-approval.test.ts` (7),
  `tests/integration/mcp-tenant-isolation.test.ts` (2),
  `tests/integration/ai-draft-executor.test.ts` (6, preserved browser
  contract).
- Live wire tests against `bun dev` with the Hermes Python MCP client:
  initialize, tools/list (10 tools), read tools, prepare with fail-closed
  capability behavior, namespaced idempotency (same-input replay returns the
  same draft; changed input returns `IDEMPOTENCY_CONFLICT`), capability
  issuance only with the UI extension, rotation on re-render, stale
  capability rejection, single execution with persisted receipt
  (`approval_channel: mcp_app`, consumed capability), receipt-replay
  protection, durable audit rows, and an agent-driven session where GLM
  5.3 Flash searched courses/tasks, prepared a draft, and confirmed it
  could not commit.
