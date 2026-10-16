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
shown in the app under **Preferences > MCP & AI Clients**.

### API keys (personal use)

Create a static API key under **Preferences > MCP & AI Clients**
(read-only, or read + write to allow proposing task changes). The key is
shown exactly once and stored only as a sha256 hash; it authenticates as
your account. Point the client at `https://<app-origin>/api/mcp`:

```yaml
mcp_servers:
  secondbrain:
    url: "https://<app-origin>/api/mcp"
    headers:
      Authorization: "Bearer sb_mcp_<your-api-key>"
```

Revoking an MCP API key from **Preferences > MCP & AI Clients** takes effect
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
- API keys are 256-bit random secrets, shown once, stored only as sha256
  hashes, and capped at 10 active per user.
- Revocation is local and immediate; revoked API keys fail even if unexpired.
