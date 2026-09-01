# Second Brain MCP Integration

Second Brain exposes a remote Model Context Protocol (MCP) server so
compatible AI clients (Hermes, Claude, ChatGPT, OpenCode, any MCP client)
can read your courses and tasks and propose task changes that you approve.

Architecture and security decisions: [docs/mcp-adr.md](mcp-adr.md).

## Endpoint

```
https://<app-origin>/api/mcp
```

Stateless Streamable HTTP (protocol revision `2025-11-25`). Every request
authenticates independently with a bearer token; browser cookies are never
accepted on this endpoint.

## Tools

| Tool | Scope | Model-visible | What it does |
| --- | --- | --- | --- |
| `search_courses` | read | yes | Find courses by code or name |
| `search_tasks` | read | yes | Search tasks with filters |
| `get_task` | read | yes | One task with full notes |
| `list_course_tasks` | read | yes | All tasks of one course |
| `resolve_course_week` | read | yes | Calendar dates for course week N |
| `prepare_task_changes` | write | yes | Validate and store a review draft |
| `render_task_review` | write | yes | Re-render a pending draft, rotate capability |
| `get_task_draft` | read | yes | Draft status + execution receipt |
| `commit_task_changes` | write | app-only | Execute an approved draft |
| `reject_task_changes` | write | app-only | Reject a pending draft |

The model never sees the approval capability. In hosts that implement MCP
Apps the commit/reject tools are hidden from the model tool list and called
only by the review card component. Clients without MCP Apps support receive
a web review URL instead of a capability (fail closed).

## Task-change flow

1. The model calls `prepare_task_changes` with the proposed actions
   (add/update/delete, 1-20 per request). Nothing changes yet; an immutable
   draft is stored with before/after review data.
2. A review card (in the host) or the web review page
   (`/mcp/review/<draftId>`) shows exactly what will change, with warnings
   and risk levels. Deletions are styled destructively.
3. Approval consumes a one-time capability and executes the stored payload
   atomically. Duplicate, stale, expired, cross-user, cross-grant, and
   cross-client commits all fail.
4. `get_task_draft` returns the persisted receipt after execution, so a lost
   response never leaves the outcome unknown.

Drafts expire after 24 hours; approval capabilities expire after 10 minutes.

## Connecting a client

Point the client at `https://<app-origin>/api/mcp` with a bearer token that
carries the `secondbrain:read` and/or `secondbrain:write` scopes and the
required claims (`sub`, `client_id`, `grant_id`). In Hermes, for example:

```yaml
mcp_servers:
  secondbrain:
    url: "https://<app-origin>/api/mcp"
    headers:
      Authorization: "Bearer <token>"
```

Local development: with `MCP_DEV_TOKEN_SECRET` set in `.env` and the dev
server running, sign in to the app and `POST /api/mcp/dev-token` from the
browser session to mint a 1-hour test token and register the connection.

Revoke any client from Preferences > Profile > Connected AI clients.
Revocation is immediate, even for unexpired tokens.

## What is sent to the AI provider

When a connected client works with your account, your course and task data
returned by the read tools (titles, notes, dates, statuses) is processed by
that client's AI model. Second Brain never invokes a model itself and never
sends data to an AI provider on its own. Approval capabilities are never
part of model-visible tool output. Disconnecting a client stops all future
access immediately.

## Privacy and security summary

- Reads are automatic and user-scoped; the token subject is the only
  identity source.
- Task changes always require explicit approval; the model cannot commit.
- Approval capabilities are single-use, 10-minute, hashed at rest, and
  bound to one draft, connection, and grant.
- Every mutation and rejection writes a durable audit event (user,
  connection, tool, draft, outcome, correlation ID, duration).
- Rate limits: 60 requests/minute per connection, 300 per 10 minutes per
  user; responses include `Retry-After`.
- Revocation is local and immediate; tokens from a revoked grant fail even
  if unexpired.
