# Second Brain MCP Integration

Second Brain exposes a remote Model Context Protocol (MCP) server so
compatible AI clients (Claude, ChatGPT, OpenCode, any MCP client)
can read your courses and tasks and propose task changes that you approve.

## Endpoint

```
https://<app-origin>/api/mcp
```

Stateless Streamable HTTP (protocol revision `2025-11-25`). Every request
authenticates independently with a bearer token; browser cookies are never
accepted on this endpoint.

## Tools

| Tool                      | Scope | Model-visible | What it does                                                    |
| ------------------------- | ----- | ------------- | --------------------------------------------------------------- |
| `search_courses`          | read  | yes           | Find courses by code or name                                    |
| `search_tasks`            | read  | yes           | Search tasks with filters                                       |
| `get_task`                | read  | yes           | One task with full notes                                        |
| `list_course_tasks`       | read  | yes           | All tasks of one course                                         |
| `resolve_course_week`     | read  | yes           | Calendar dates for course week N                                |
| `list_supported_schools`  | read  | yes           | Universities with a course-plan pipeline                        |
| `list_terms`              | read  | yes           | Previous, current, and next terms                               |
| `prepare_task_changes`    | write | yes           | Validate and store a review draft                               |
| `prepare_course_creation` | write | yes           | Validate a new course, preview plan tasks, store a review draft |
| `render_task_review`      | write | yes           | Reopen a pending draft and return its web review link           |
| `get_task_draft`          | read  | yes           | Draft status + execution receipt (task or course)               |

MCP prepares drafts but cannot approve them. Review and approve or reject each
draft in the authenticated Second Brain web app. MCP client metadata cannot
prove that a human saw or approved a review card.

## Task-change and course-creation flow

1. The model calls `prepare_task_changes` with the proposed actions
   (add/update/delete, 1-20 per request), or `prepare_course_creation`
   with a course code, a user-confirmed term (`YYYY[1-3]`, via
   `list_terms`), and a school (via `list_supported_schools`; `ets` runs
   the PlanETS pipeline, `none` creates an empty course). Nothing changes
   yet; an immutable draft is stored with before/after review data. Course
   drafts freeze the server-parsed plan tasks at prepare time.
2. The authenticated web review page (`/mcp/review/<draftId>`) shows exactly
   what will change, with warnings
   and risk levels. Deletions are styled destructively.
3. Web approval executes the stored payload atomically. Duplicate, stale,
   expired, and cross-user commits fail.
4. `get_task_draft` returns the persisted receipt after execution, so a lost
   response never leaves the outcome unknown.

Drafts expire after 24 hours.

## Connecting a client

Step-by-step instructions (server URL and a copyable example config) are
shown in the app under **Settings > MCP & AI Clients**.

### API keys (personal use)

Create a static API key under **Settings > MCP & AI Clients**
(read-only, or read + write to allow proposing task changes). The key is
shown exactly once and stored only as a salted scrypt verifier; it
authenticates as your account. Point the client at `https://<app-origin>/api/mcp`:

```yaml
mcp_servers:
  secondbrain:
    url: "https://<app-origin>/api/mcp"
    headers:
      Authorization: "Bearer sb_mcp_<your-api-key>"
```

Revoking an MCP API key from **Settings > MCP & AI Clients** takes effect
immediately.

## What is sent to the AI provider

When an MCP client using your API key works with your account, your course and task data
returned by the read tools (titles, notes, dates, statuses) is processed by
that client's AI model. Second Brain never invokes a model itself and never
sends data to an AI provider on its own. MCP tools cannot approve drafts.
Disconnecting a client stops all future access immediately.

## Privacy and security summary

- Reads are automatic and user-scoped; the token subject is the only
  identity source.
- Task changes always require approval in the authenticated web app; MCP
  clients cannot commit or reject drafts.
- Every mutation and rejection writes a durable audit event (user,
  connection, tool, draft, outcome, correlation ID, duration).
- Rate limits: 60 requests/minute per connection, 300 per 10 minutes per
  user; responses include `Retry-After`.
- API keys are 256-bit random secrets, shown once, stored only as salted
  scrypt verifiers, and capped at 10 active per user.
- Revocation is checked against the current connection row on every request,
  including requests that reuse a cached cryptographic verification.

## Authentication CPU and local verification

Successful scrypt verification is reused only inside the current warm process,
for at most five minutes and 1,000 entries. The cache holds a SHA-256 lookup
digest, connection ID and the exact stored salted verifier, never a raw key or
authorization context. A fresh database lookup still supplies identity, scopes
and revocation state for every request. Deleted rows, changed connection IDs,
changed/missing/malformed verifiers and expiry require verification again or fail
closed. Failed secret checks are not cached. Durable rate limits and per-request
last-used writes are unchanged; approval capabilities still use uncached scrypt.
There is no shared cache service or persistent fast-hash key verifier.

Run the normal security regressions and the optional CPU measurement with the
repository's Bun 1.3.6 toolchain:

```sh
bun run test:unit:run --api=false tests/unit/mcp-auth.test.ts
bun run bench:mcp-auth
```

The authentication test uses the Node environment and real `node:crypto` scrypt.
The benchmark makes 100 uncached authentications by advancing only the cache
clock past its TTL between requests, then 100 warm authentications. Each mock
query returns a fresh connection object. Assertions require 100 database
lookups in each phase, 100 uncached KDF calls and zero warm KDF calls. CPU time
uses `process.cpuUsage`; wall time is reported separately. The benchmark is
opt-in and imposes no timing threshold on CI. `--api=false` disables Vitest's
optional development control socket, preserving the test suite in offline
sandboxes. It does not disable any authentication or test assertion.

Measured November 7, 2026, Bun 1.3.6 with Node v24.22.1 in the isolated
MHI-47 check workspace (fresh mocked database rows; no network):

| Mode | Requests | Database lookups | scrypt calls | CPU | Wall time |
| --- | ---: | ---: | ---: | ---: | ---: |
| Uncached | 100 | 100 | 100 | 4,417.160 ms | 4,415.211 ms |
| Warm | 100 | 100 | 0 | 15.081 ms | 9.295 ms |

That is about 99.7% lower CPU for this measured warm authentication path. It is
not a measurement of total function CPU or a production savings guarantee. It
excludes real database/network cost, MCP transport/tool execution, rendering and
cold-process startup. New instances still perform scrypt and do not share this
cache. The supplied 30-day Vercel totals do not identify the responsible function
or time interval, so they cannot establish MCP as the cause of the reported
spike. Static inspection found the KDF per matching request and per-request
last-used writes; the cron configuration is daily, monthly or every five days,
and inspected interval timers are client UI timers rather than request polling.

Before attributing production savings, compare a redacted per-function/time
usage export over comparable traffic after an owner-approved rollout. No Vercel
account connection, paid plan, credential change or production deployment is
part of this local investigation.
