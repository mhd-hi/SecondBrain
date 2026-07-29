# Multi-model LLM fallback for course-plan → task generation

## Status

As of **July 28, 2026**, the course-plan task generation path has the foundation
of a sequential multi-provider fallback chain, but it is **not complete yet**.
The task-generation entry point is
[src/lib/ai/course-plan.ts](src/lib/ai/course-plan.ts), which builds the prompt
([prompt.ts](src/lib/ai/prompt.ts)), calls
[call.ts](src/lib/ai/call.ts) through a provider-aware client cache in
[client.ts](src/lib/ai/client.ts), and parses the response text into a JSON
array ([parse.ts](src/lib/ai/parse.ts)).

Already implemented:
- providers with unset API keys are skipped
- configured provider/model attempts are tried in order
- one SDK client is cached per provider
- the route no longer depends on the old `registry.ts`, `config.ts`, or
  `openai.ts` naming

Required before the fallback is complete:
- validate each response inside the fallback attempt, including the full
  `AITask[]` shape, before accepting it
- treat invalid or malformed task output as a failed attempt and continue
- bound every attempt and the overall chain with timeouts
- thread the route's abort signal through the whole call and never fall back
  after the caller disconnects
- disable SDK-level retries so the explicit provider/model chain owns retry
  behavior
- remove shared sampling parameters that conflict with provider-specific model
  requirements and cap completion output
- replace retired model IDs and configure two real NVIDIA models
- stop logging raw user context, prompts, or model responses
- bound untrusted course-plan input and generated task collections
- map terminal AI failures to safe route codes and statuses
- enable request cancellation in the deployment configuration
- add the user-facing third-party AI provider disclosure

The target architecture remains:
- one onboarding/course-import task generator
- one fallback caller
- multiple providers tried in order

The required fallback behavior is intentionally simple:
- skip providers whose API key is unset
- try configured providers in order
- accept the first non-empty text response that passes the caller's expected-output validation
- throw once after every configured attempt fails or the overall deadline expires

For course-plan generation, expected-output validation includes parsing the
response and validating it with Zod as a non-empty array of complete tasks.
`[{}]`, missing required fields, invalid task types, invalid week/effort values,
and non-array JSON are failed attempts. The next configured provider/model must
then be tried. Keep the generic text caller separate by passing it a
course-plan-specific validator callback. Parse the entire response directly
with `JSON.parse`; do not extract an array from wrappers, code fences, regex, or
partial mutations. A response such as `{"tasks": [...]}` is invalid because the
required top-level value is the array itself.

We still use the `openai` SDK because the configured providers expose
OpenAI-compatible chat-completions endpoints. This is an SDK choice, not an
architecture commitment to OpenAI as the primary provider.

Provider order, verified against provider catalogs on **July 28, 2026**:
**Groq → Google AI Studio → Cerebras → NVIDIA NIM → OpenRouter → OpenAI**.
Availability and quotas are account-specific and change frequently, so the
plan intentionally does not hardcode rate-limit numbers.

- Groq uses `openai/gpt-oss-120b`. The previous
  `llama-3.3-70b-versatile` is scheduled to shut down on August 16, 2026;
  see [Groq deprecations](https://console.groq.com/docs/deprecations).
- Google AI Studio uses `gemini-3.6-flash`, the recommended replacement for
  `gemini-2.5-flash`, which is scheduled to shut down on October 16, 2026; see
  [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations).
  Active limits must be read from the project's AI Studio quota page; see
  [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).
- Cerebras uses `gpt-oss-120b`. The previous `llama-3.3-70b` is retired;
  see [Cerebras deprecations](https://inference-docs.cerebras.ai/support/deprecation).
  Cerebras access may be a payment-verified, time-limited trial rather than a
  permanent free tier, so it remains optional and is skipped without a key.
- NVIDIA uses two hosted prototype models in order:
  `meta/llama-3.3-70b-instruct`, then
  `nvidia/nemotron-3-super-120b-a12b`; see the
  [NVIDIA Llama endpoint](https://build.nvidia.com/meta/llama-3_3-70b-instruct)
  and [NVIDIA Nemotron endpoint](https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b?nim=hosted).
- OpenRouter uses `openrouter/free`, which selects an available free model
  supporting the request; see
  [OpenRouter's free router](https://openrouter.ai/docs/guides/routing/routers/free-router).
- OpenAI uses paid `gpt-4o-mini` only as the final configured fallback.

Google AI Studio is the product issuing the Gemini API key used with
`generativelanguage.googleapis.com`. Every provider is skipped if its API key
is unset, so the chain works when only a subset of keys is configured.

Model choice per provider is pulled from **one small `PROVIDER_MODELS` map at
the top of `providers.ts`** (see below) — each provider owns an ordered
`models[]` list. Swapping a model, adding a second or third model to one
provider, or reordering the per-provider fallback is a one-line edit in one
place, no env var or redeploy config needed. Endpoint URLs and key lookup stay
separate below it since those rarely change, keeping the "thing you'll
actually want to tweak often" isolated from the rest.

## Required provider configuration

```ts
type ProviderConfig = {
  name: string;
  apiKey: string;
  baseURL: string;
  models: readonly string[];
};

// Change models here — nowhere else. Order matters within each provider.
const PROVIDER_MODELS = {
  groq: ['openai/gpt-oss-120b'],
  'google-ai-studio': ['gemini-3.6-flash'],
  cerebras: ['gpt-oss-120b'],
  nvidia: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/nemotron-3-super-120b-a12b',
  ],
  openrouter: ['openrouter/free'],
  openai: ['gpt-4o-mini'],
} as const;

function buildProviders(): ProviderConfig[] {
  return [
    env.GROQ_API_KEY && { name: 'groq', apiKey: env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1', models: PROVIDER_MODELS.groq },
    env.GOOGLE_AI_STUDIO_API_KEY && { name: 'google-ai-studio', apiKey: env.GOOGLE_AI_STUDIO_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', models: PROVIDER_MODELS['google-ai-studio'] },
    env.CEREBRAS_API_KEY && { name: 'cerebras', apiKey: env.CEREBRAS_API_KEY, baseURL: 'https://api.cerebras.ai/v1', models: PROVIDER_MODELS.cerebras },
    env.NVIDIA_API_KEY && { name: 'nvidia', apiKey: env.NVIDIA_API_KEY, baseURL: 'https://integrate.api.nvidia.com/v1', models: PROVIDER_MODELS.nvidia },
    env.OPENROUTER_API_KEY && { name: 'openrouter', apiKey: env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1', models: PROVIDER_MODELS.openrouter },
    env.OPENAI_API_KEY && { name: 'openai', apiKey: env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', models: PROVIDER_MODELS.openai },
  ].filter(Boolean) as ProviderConfig[];
}

function buildProviderAttempts() {
  return buildProviders().flatMap(provider =>
    provider.models.map(model => ({ ...provider, model })),
  );
}
```

Re-check these model IDs against the provider catalogs immediately before each
deployment that changes AI configuration. A retired model must be removed from
the map rather than left as an expected failing attempt.

## Required course-plan fallback completion

Keep `callWithFallback` generic, but give it an optional expected-output
validator and caller-owned request-options callback. The validator and callback
run inside each attempt before that attempt can return. The callback receives
the current `ProviderAttempt`; this keeps course-plan output limits and
model-specific JSON-generation settings out of the generic fallback caller and
prevents the future chatbot from inheriting them.

For course-plan generation, validation must:

- parse the complete response as JSON without extraction heuristics
- validate an `AITask[]` with Zod containing between 1 and 100 tasks
- require `week` as an integer greater than zero
- require `type` to match the existing task-type enum
- require a trimmed, non-empty title of at most 300 characters
- require a finite `estimatedEffort` greater than or equal to the existing
  `MIN_TASK_ESTIMATED_EFFORT` value (`0.5`)
- limit optional notes to 2,000 characters
- allow at most 25 subtasks per task; require each subtask title to be trimmed,
  non-empty, and at most 300 characters, and limit optional subtask notes to
  2,000 characters
- reject unknown task and subtask fields

Build the schema from the existing `TASK_TYPES` values and
`MIN_TASK_ESTIMATED_EFFORT`; do not introduce another task-type list. Use
strict task and subtask objects, require every subtask title to be non-empty,
and reject unknown fields rather than stripping them.

If parsing or validation throws, catch that error as the current attempt's
failure and continue to the next model. The successful response may be parsed
again by the caller; the small duplicate parse is preferable to adding a new
generic result abstraction.

Reject `htmlData` longer than **500,000 characters** before building the prompt
or starting any provider attempt. Keep the existing 3,000-character
`MAX_USER_CONTEXT_LENGTH` limit. These are trust-boundary constants, not
user-configurable settings. Oversized input returns `AI_INPUT_TOO_LARGE`; an
oversized model response is an invalid attempt and falls through normally.

Configure the cached SDK clients with `maxRetries: 0`. Bound each request with
a **20-second attempt timeout** and bound the entire fallback call with a
**60-second overall deadline**. These bounds intentionally mean that slow early
providers can consume the deadline before every configured attempt is reached.
Do not claim that every provider is guaranteed an attempt.

Pass `request.signal` from the route through `generateCoursePlanTasks(...)` and
`callWithFallback(...)`, then into the SDK request options. Combine the caller,
overall-deadline, and per-attempt signals with native `AbortSignal.any(...)` and
`AbortSignal.timeout(...)`. A per-attempt timeout is a failed attempt and falls
through; caller cancellation or the overall deadline aborts the chain
immediately and must not start another provider.

Keep these terminal outcomes distinct with safe error codes:
- `AI_INPUT_TOO_LARGE` for course-plan HTML rejected before provider execution
- `AI_ABORTED` for caller cancellation
- `AI_DEADLINE_EXCEEDED` for the overall deadline
- `AI_PROVIDERS_EXHAUSTED` when all configured attempts fail or none are
  configured

Use one small typed AI error carrying only one of those codes. The route maps
them without exposing provider messages, causes, or stacks:

| Code | HTTP status | Safe route message |
| --- | ---: | --- |
| `AI_INPUT_TOO_LARGE` | 413 | `Course-plan input is too large` |
| `AI_ABORTED` | 499 | `AI processing was cancelled` |
| `AI_DEADLINE_EXCEEDED` | 504 | `AI processing timed out` |
| `AI_PROVIDERS_EXHAUSTED` | 503 | `AI processing is temporarily unavailable` |

Add `code?: string` to the pipeline step error shape and return the code on the
errored `step`, with `data: null`. If the connection has already closed, stop
work and do not attempt to write a response. Unexpected errors remain the
existing generic HTTP 500 path.

Caller cancellation and the overall deadline must bypass the normal
per-provider failure warning path. The route must not report cancellation as a
provider failure or collapse these outcomes into a misleading generic error.

Do not send one shared `temperature` or `top_p` value to every provider. Use
provider/model defaults for now; add per-model overrides only if a verified
model requires them. This avoids conflicting with models such as NVIDIA
Nemotron 3 Super, whose hosted example recommends `temperature: 1` and
`top_p: 0.95`. Add the smallest per-model request-options entry for Nemotron
with those values, and explicitly disable its reasoning mode for strict JSON
course-plan generation with `reasoning_effort: 'none'`. Do not apply those
options to other models. The course-plan caller's request-options callback adds
`max_tokens: 8192` to every attempt and adds the three Nemotron-specific fields
only when `attempt.model === 'nvidia/nemotron-3-super-120b-a12b'`. These options
must not become defaults in `callWithFallback`.

SDK client lookup/construction, the API request, empty-response checking, and
expected-output validation all belong inside the same per-attempt `try` block.

Log only provider name, model, timing, response length, and allow-listed error
metadata: error name, provider HTTP status, and provider error code. Do not log
an error message, cause, stack, raw course-plan HTML, user context, prompts, or
response snapshots to console or Sentry. Fallback may send the same input to
multiple configured vendors, so this data boundary must remain explicit.

Treat both course-plan HTML and user context as untrusted data. Delimit both in
the prompt and state that instructions inside either source cannot override the
system prompt or output contract.

Logging restrictions do not control provider-side retention. Course HTML and
user context may be sent to every configured fallback vendor, and
`openrouter/free` may route them to a changing underlying provider. Configure
only providers approved to receive this data, document that disclosure for
users, and leave unapproved provider keys unset.

Before the first AI request, show a short disclosure beside the course-import
submit action: course-plan content and optional context may be sent to the
deployment's configured third-party AI providers. Link it to a user-facing
privacy notice that lists the approved configured providers and explicitly
states that `openrouter/free` may select a changing underlying provider. This
notice is a completion requirement, not a future documentation task.

- [src/lib/ai/providers.ts](src/lib/ai/providers.ts) builds the ordered
  provider/model attempts from env.
- [src/lib/ai/client.ts](src/lib/ai/client.ts) caches one SDK client per
  provider.
- [src/lib/ai/call.ts](src/lib/ai/call.ts) iterates providers in order and
  returns `{ text, usage, model, provider, finish_reason }`.
- [src/lib/ai/course-plan.ts](src/lib/ai/course-plan.ts) is the single
  onboarding/course-import task-generation entry point.
- [src/env.js](src/env.js) and [.env.example](.env.example) include the free
  provider keys plus optional OpenAI last-resort fallback.
- [src/app/api/course-pipeline/route.ts](src/app/api/course-pipeline/route.ts)
  calls the course-plan generator directly. There is no separate provider
  registry layer anymore.
- [vercel.json](vercel.json) must opt the course-pipeline function into request
  cancellation with `supportsCancellation: true` and set `maxDuration: 65`, so
  the platform allows the application-level 60-second deadline to finish.

Reordering the fallback chain is still just the provider array order in
`buildProviders()`. Reordering models inside one provider is just the order of
that provider's `models[]`.

## Verification

- `tests/unit/ai-call-fallback.test.ts` covers ordered fallback and the
  unconfigured-provider failure case.
- Add a course-plan fallback test where an earlier provider returns each of:
  invalid JSON, wrapped/non-array JSON, `[{}]`, an empty array, a task with an
  invalid enum/value, effort below `0.5`, and unknown fields. A later provider
  returning a valid task array must be used.
- Add a timeout test proving that an expired attempt is aborted and the next
  provider is tried, plus an overall-deadline test proving no later attempt is
  started after the chain expires.
- Add a caller-cancellation test proving the active request is aborted and no
  fallback provider is attempted.
- Add route tests asserting the four AI error codes, HTTP statuses, safe
  messages, and `data: null`; assert provider error text is never returned.
- Assert HTML over 500,000 characters is rejected before building clients or
  starting attempts. Assert the task, subtask, title, and notes limits reject an
  early response and allow a later valid provider response.
- Add a provider-configuration test that asserts the current model IDs and both
  ordered NVIDIA attempts. Do not satisfy this with invented attempts that
  bypass `buildProviderAttempts()`.
- Assert cached SDK clients use `maxRetries: 0`.
- Assert course-plan requests omit shared sampling parameters, apply the 8,192
  output-token cap, and receive the combined abort signal. Assert only Nemotron
  receives `temperature: 1`, `top_p: 0.95`, and
  `reasoning_effort: 'none'`; a generic fallback call must receive none of these
  course-plan defaults.
- Verify the deployed route has request cancellation enabled and a 65-second
  maximum duration; disconnect a real course-import request and confirm the
  active provider request is aborted.
- Verify the course-import UI shows the vendor disclosure before submission and
  links to the provider-specific privacy notice.
- Manually verify: set only `GROQ_API_KEY` (unset `OPENAI_API_KEY`), run the
  existing course-import flow end-to-end (`/api/course-pipeline` step `ai`)
  against a real or sample course-plan HTML, confirm tasks are generated.
- Then unset `GROQ_API_KEY` too (simulate exhaustion/outage) and confirm the
  chain correctly falls through to the next configured key, and that with zero
  keys configured it throws `AI_PROVIDERS_EXHAUSTED` instead of a confusing
  per-provider stack trace.

## Out-of-scope follow-up architecture: task-action chatbot

This is a **separate feature from course-plan parsing fallback** and should be
built as a tool-driven, approval-gated system from day one so we do not later
rewrite a direct-model-to-DB prototype.

### Decision

We are **not** using embeddings / a vector index for v1.

Reason:
- the hard problem here is not semantic retrieval quality first, it is
  identifying the exact task(s), computing the intended mutation safely, and
  applying it against fresh authoritative state
- task data is connected/historical, so stale embedded snapshots are the wrong
  source of truth for writes
- embeddings may become a later fallback for fuzzy references, but they are
  not the core architecture for add/update/delete flows

So v1 uses:
- LLM for intent parsing and action drafting
- DB-backed read tools for fresh task state
- explicit pending-action drafts
- user approval before any mutation
- deterministic execution through existing server-side task functions

Do not create a database view for AI context. A normal view only hides a query;
it does not reduce tokens, and a materialized view would be stale at the point
where approval safety matters. Use one `getAiTaskContext(...)` query helper
instead, reusing existing task/course queries and selecting only the fields
needed by the current tool call.

### Core architecture

The model must **never write directly** to the database and must **never**
auto-execute mutations.

Flow:
1. user sends a chat message with a client-generated `requestId`
2. model calls narrow read tools to inspect the user's current task state
3. model either replies normally or proposes one concrete action draft
4. server validates the draft payload with `zod`
5. UI shows a human-readable approval preview
6. user approves or rejects
7. only approved drafts are executed
8. execution re-reads fresh DB state and applies the mutation

### Chatbot model/provider order

For the task-action chatbot, use this provider order:
- Google AI Studio — an explicitly configured, verified Gemini Flash model
- Groq
- NVIDIA
- OpenRouter free-tier models

Provider and model are separate concepts. Add a small chat-specific provider
map keyed by provider name, with each value containing its ordered model list:

```ts
const CHAT_PROVIDER_MODELS = {
  'google-ai-studio': ['gemini-3.6-flash'],
  groq: ['openai/gpt-oss-120b'],
  nvidia: [
    'nvidia/nemotron-3-super-120b-a12b',
    'meta/llama-3.3-70b-instruct',
  ],
  openrouter: ['openrouter/free'],
} as const;
```

Verify the exact available models and their tool support immediately before
implementation and deployment. Keep this configuration separate from the
course-plan map because the chatbot requires tool calling and validated planner
output.

Reason:
- Gemini stays primary for the best free tool-calling value
- Groq is preferred ahead of OpenRouter for better operational stability
- NVIDIA adds another independent fallback
- OpenRouter stays last-resort because of reliability/rate-limit issues

Rules:
- fallback providers may be used for planning/drafting only
- approval requirements stay identical for every provider
- if a provider returns flaky or malformed tool output, skip it and try the next
- do not require one portable request to combine tools and strict
  `response_format`; use tool-enabled read rounds, then a final tool-free JSON
  output round validated with Zod

### Read tools

Use structure-first retrieval from the database, not "all tasks in prompt".

Initial read tools:
- `search_courses(query)`
- `search_tasks(query, courseId?, status?, dateRange?, limit?)`
- `get_task(taskId)`
- `list_course_tasks(courseId)`
- `get_related_tasks(taskId)`

Notes:
- `search_courses(...)` resolves a course code/name to an owned `courseId`,
  including courses that have no tasks yet
- prefer SQL filters and exact/partial title matching first
- only load the subset of tasks relevant to the current request
- always re-read the target task(s) immediately before execution
- every result is scoped by `userId` and includes `id`, `courseId`, `title`,
  `dueDate`, `status`, and `updatedAt`; notes are included only within the
  retrieval budget below
- `get_related_tasks(...)` is part of v1; it excludes the target, returns at
  most 20 same-course tasks that are within 14 days before/after the target or
  have a case-insensitive exact/substring title match, and orders them by
  absolute due-date distance then task ID
- related-task results are advisory context and warnings, never implicit
  mutation targets; add broader fuzzy matching only if real requests show the
  deterministic v1 rule is insufficient

### Planner limits and target selection

Keep the planner bounded and deterministic. Store these as small constants in
the chat planner, not user-configurable settings:
- maximum 4 read-tool rounds per provider attempt
- maximum 20 seconds per provider request
- maximum 60 seconds total wall-clock time across all providers and tool rounds
- maximum 1,200 generated tokens per provider response
- maximum 12,000 characters of task notes/descriptions across one planner run

If a provider times out, exceeds a limit, returns malformed JSON, or fails Zod
validation, discard that response and try the next provider. Never attempt to
repair a malformed mutation payload with regex or partial JSON.
When the total deadline expires, abort the active provider/tool call, emit the
safe SSE `error` event followed by `done`, and do not start another provider
attempt.

Each fallback provider starts a new planner attempt from the original user
message and authenticated UI context. It does not inherit another provider's
unvalidated assistant messages or tool calls, and it receives its own allowance
of up to four read-tool rounds. The total wall-clock and retrieval budgets remain
global across all attempts.

A provider tool call is valid only when its name is one of the declared tools
and its arguments pass that tool's Zod schema. Unknown tools, invalid arguments,
or tool calls beyond the round limit fail that provider attempt and fall through
to the next provider.

Do not use model-reported confidence to select targets. A batch is allowed only
when the request gives a deterministic set (for example, an explicit course,
date range, status filter, or selected task IDs). If multiple candidates remain
and the request does not define the intended set, return `clarification` with
candidate choices before drafting an update or delete.

Task titles, notes, and other tool-returned text are untrusted data, never
instructions. The planner's system prompt must state that task content cannot
change system rules, authorize an action, request secrets, or override the
approval gate.

### Ambiguous and multi-task resolution

The assistant is allowed to operate on **multiple tasks in one request**.

That means:
- `search_tasks(...)` may intentionally return multiple matches
- one pending draft may contain multiple adds, updates, and deletes together
- batch actions are in scope for this feature

Rules:
- if the user's request clearly targets a set of tasks, the model may draft a
  batch action
- if multiple tasks match but the intended target set is still ambiguous, the
  model must ask a clarification question or present candidate matches instead
  of drafting a destructive action blindly
- destructive actions (`delete`, large reschedules) should require especially
  clear targeting before drafting

### Draft creation

The model has **read tools only** in v1. Do not expose
`propose_add_task`, `propose_update_task`, or `propose_delete_task` as tools,
and do not persist anything during provider/tool rounds.

There is one draft-creation path:
1. the model finishes its read-tool rounds
2. the model returns one `PlannerOutput`
3. the server validates it with Zod
4. the server re-reads and validates every referenced course/task
5. the server generates the trusted review payload
6. the server inserts exactly one pending draft keyed by `(userId, requestId)`

This single path supports mixed add/update/delete batches without creating
fragmented, duplicate, or orphaned drafts during fallback or cancellation.
The client generates one `requestId` per logical message and reuses it only
when retrying that message. At the start of each request, an existing
authenticated draft with that key short-circuits planning and emits
`draft.ready` with its `draftId`, followed by `done`. The unique index also
closes concurrent insert races: on conflict, return the existing draft without
overwriting it or creating another.

Suggested draft shape:

```ts
type PendingActionDraft = {
  id: string;
  requestId: string;
  userId: string;
  status: 'pending' | 'executing' | 'rejected' | 'executed' | 'stale' | 'expired' | 'failed';
  summary: string;
  reason: string;
  actions: Array<
    | {
        type: 'add_task';
        courseId: string;
        task: {
          title: string;
          notes?: string;
          dueDate: string;
          status?: string;
          estimatedEffort?: number;
          actualEffort?: number;
          type?: string;
        };
      }
    | {
        type: 'update_task';
        taskId: string;
        changes: {
          title?: string;
          notes?: string;
          dueDate?: string;
          status?: string;
          estimatedEffort?: number;
          actualEffort?: number;
          type?: string;
        };
      }
    | {
        type: 'delete_task';
        taskId: string;
      }
  >;
};
```

Persist alongside:
- client-generated `requestId`
- `summary`
- `reason`
- `createdAt`
- `expiresAt`
- `reviewPayload`
- `taskVersions: Record<taskId, updatedAt>` for every existing task read into
  an update/delete draft
- nullable server-written `failureCode`

Use a table named `ai_action_drafts`. Keep the batch, task versions, and
review payload in JSON columns; keep `id`, `requestId`, `userId`, `status`,
`createdAt`, and `expiresAt` as regular indexed columns, and `failureCode` as
an unindexed text column. Add a unique index on `(userId, requestId)`. Include
`payloadVersion: 1` in the JSON payload. When the current payload contract
changes, invalidate old pending drafts and require a new logical request with a
new `requestId` to regenerate them using the newest version; never execute a
draft with an unsupported payload version. Chat messages remain client-local
and are not stored in this table.

An unsupported payload version does not need another status. On access or
approval, conditionally mark the still-pending draft `failed`, record
`unsupported_payload_version` as its failure/audit code, and require a new
draft.

### Planner output contract

The planner must return validated JSON, never a free-form mutation. Its output
is one of these three shapes:

```ts
type PlannerOutput =
  | { kind: 'reply'; message: string }
  | {
      kind: 'clarification';
      message: string;
      options?: Array<{ label: string; taskId?: string; courseId?: string }>;
    }
  | {
      kind: 'draft';
      message: string;
      summary: string;
      reason: string;
      actions: PendingActionDraft['actions'];
    };
```

Validate this output with Zod before persisting anything. The model supplies
only the proposed actions and explanation. The server loads fresh task data,
validates action fields, captures `taskVersions`, and generates
`reviewPayload` (before/after values, diffs, counts, warnings, and risk level).
The server, not the model, computes `riskLevel`. The model never supplies
execution state or trusted diffs. A validated `kind: 'draft'` output is the
only model-produced input from which the server may create an
`ai_action_drafts` row.

The draft schema must require at least one action, reject empty update objects,
and reject any repeated existing `taskId` across update/delete actions. For
example, updating and deleting the same task in one draft is invalid rather
than order-dependent. Invalid planner output fails that provider attempt and
falls through.

### Execution layer

Do **not** have the AI layer call the app's own REST routes over HTTP.

Reuse the existing logic from [src/lib/auth/db.ts](src/lib/auth/db.ts), but do
**not** call the current helpers as-is for batch execution. Today those helpers
close over the global `db` client and perform multi-step writes internally, so
they cannot provide atomic multi-action execution by themselves.

This keeps:
- authorization logic centralized
- execution deterministic
- the AI layer as orchestration, not a parallel API client

Batch execution must be atomic, so add the smallest transaction-aware path
before building the chatbot executor:
- refactor the shared task helpers to accept a DB executor / transaction, or
  add transaction-aware variants next to them
- in one database transaction, conditionally claim the draft, lock target
  rows, run ownership/stale checks, apply every action, and mark the draft
  `executed`
- lock update/delete targets in stable task-ID order with `FOR UPDATE`, then
  compare their fresh `updatedAt` values with `taskVersions`
- lock/re-check owned course rows needed by add actions in the same transaction
- if anything fails, roll back the claim and every task mutation together;
  only after rollback may a separate conditional update mark the still-pending
  draft `failed` or `stale`

### Consistency / impact review

There is no explicit dependency graph in the current codebase, but course tasks
still have **historical/semantic coupling** because they represent topics across
time in a semester.

So v1 should not pretend to solve dependency propagation perfectly, but it
should still do a consistency pass before drafting or executing large changes.

Rules:
- before drafting updates/deletes, load nearby course tasks: same course,
  tasks inside a fixed due-date window around each target, and similar-title
  candidates (plus module/week when that metadata exists)
- the review payload should surface potentially impacted neighboring tasks
- the system does **not** auto-rewrite neighboring tasks in v1 unless they are
  explicitly included in the draft
- if a requested change likely implies a broader schedule shift, the assistant
  should return a clarification offering the related candidates; only the
  user's confirmed targets may be added to a multi-task draft

The consistency pass and `get_related_tasks(...)` are advisory and
deterministic. They identify nearby tasks for review and warnings, but never add
actions by themselves. Nothing outside the user's explicit request or a
confirmed clarification response can be included in the reviewed batch or
modified.

### Storage

Pending approvals should be stored in the **database**, not only in memory.

Reason:
- refresh-safe
- user can approve later
- audit trail is possible
- cleaner architecture than session-only pending actions

### Approval UX contract

The approval surface should be a dedicated **review dialog**, opened after the
user clicks a review button.

That dialog should render diffs directly for the whole draft:
- added tasks
- updated tasks
- deleted tasks
- impacted neighboring tasks / consistency warnings

Recommended shape for `reviewPayload`:
- `summary`
- `counts: { adds, updates, deletes }`
- `items[]`

Each `items[]` entry should include:
- `type: 'add' | 'update' | 'delete'`
- `taskId?`
- `courseId?`
- `title`
- `before?`
- `after?`
- `diff`
- `warnings[]`
- `riskLevel: 'low' | 'medium' | 'high'`

UI recommendation:
- group by action type
- compact row list first
- expandable per-task diff rows
- destructive actions visually separated
- one approve button for the whole draft, one reject button

Before presenting an add action, check for likely duplicates in the same course:
similar title plus a nearby due date. Show these as warnings in the review
dialog. Do not silently merge, discard, or modify either task.

### SSE streaming

`POST /api/ai/chat` returns a `text/event-stream` response consumed with
`fetch` + `ReadableStream` on the client (not `EventSource`, which is GET-only).
The stream uses a small, typed event set:
- `status`: `{ status: 'searching' | 'planning' | 'validating' }`
- `message.delta`: `{ delta: string }` for a normal, non-mutating reply
- `clarification`: `{ message: string, options?: ClarificationOption[] }`,
  using the same option shape as `PlannerOutput`
- `draft.ready`: `{ draftId }` only, after the server has validated and
  persisted the draft
- `error`: `{ code: string, message: string }` with a safe user-facing message
- `done`: `{}` as the sole terminal event

Every stream that remains connected until the server finishes emits exactly one
`done`. On failure, earlier `status` events are allowed; after `error`, emit
only `done`. If the client disconnects, stop immediately and do not attempt to
emit either event.

For a mutation request, do not stream raw model JSON or partial tool arguments.
Collect the planner result, validate it, generate and persist the review
payload, then send `draft.ready`. This prevents the UI from showing or acting
on hallucinated, incomplete, or unvalidated actions. The client treats only a
persisted `draftId` as reviewable.

For a normal reply, preserve provider fallback by buffering each provider
attempt until it completes and the final reply passes validation. Only then
emit that validated text as `message.delta` chunks. `status` events may still
be emitted while providers and tools are running. Never expose partial text
from a provider attempt that may be discarded, and never concatenate partial
responses from two providers.

Pass the request `AbortSignal` through provider and tool calls. If the client
disconnects, stop unfinished provider/tool work and emit no further events.
Define the draft outcome by the database transaction: an insert that did not
commit leaves no draft, while a committed insert remains valid even if the
connection closed before its acknowledgement. A retry with the same
`requestId` returns that committed draft and never creates a duplicate.

### Initial scope

Keep v1 narrow:
- no auto-execution
- no multi-step plans
- no embeddings
- no free-form arbitrary mutation payloads
- no recurring tasks
- no automatic dependency rewrites unless explicitly included in the draft
- no perfect dependency graph inference

Bulk add/update/delete in one reviewed draft **is in scope**.

Enough for v1:
- model can inspect tasks through read tools
- model can propose add/update/delete, including multi-task drafts
- user must approve
- executor applies the approved mutation safely

### Suggested files

New AI chat orchestration area:
- `src/lib/ai/chat/types.ts`
- `src/lib/ai/chat/tools.ts`
- `src/lib/ai/chat/planner.ts`
- `src/lib/ai/chat/drafts.ts`
- `src/lib/ai/chat/executor.ts`

Routes:
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/actions/[actionId]/route.ts` (`GET` the authenticated
  persisted review payload)
- `src/app/api/ai/actions/[actionId]/approve/route.ts`
- `src/app/api/ai/actions/[actionId]/reject/route.ts`

### Concurrency / stale drafts

Drafts must be validated against fresh DB state at approval time.

Rules:
- on every authenticated draft `GET`, approve, or reject lookup, first
  conditionally change an owned draft from `pending -> expired` when
  `expiresAt <= now`; this request-time transition needs no cron job
- `GET` may then return the draft with `status: 'expired'`; approve or reject
  returns HTTP `410` with code `DRAFT_EXPIRED` and performs no task mutation
- if an approve/reject conditional update affects no row, repeat the expiry
  transition before mapping the owned draft's current status; return
  `DRAFT_EXPIRED` for expiry and a conflict for any other non-pending status
- approval must only run when draft status is `pending`
- start one transaction and conditionally change `pending -> executing`, scoped
  by `id`, `userId`, `status = 'pending'`, `expiresAt > now`, and a supported
  payload version; only the transaction that updates one row may continue
- do **not** commit the `executing` claim separately
- load and lock every update/delete target with `FOR UPDATE` in stable task-ID
  order before checking or mutating any task
- after the locks are held, compare every fresh `updatedAt` value with
  `taskVersions`; a missing task or mismatch aborts and rolls back the entire
  transaction as stale
- for add actions, lock/re-check course ownership and validate task fields in
  the same transaction
- apply all creates/updates/deletes and change `executing -> executed` before
  committing that same transaction
- if execution fails or stale validation stops it, rollback restores the draft
  to `pending` and leaves every task unchanged; afterward, conditionally update
  that still-pending draft to `failed` or `stale`
- if the server crashes before commit, the database rolls back and the draft
  remains safely `pending`; if commit succeeds, task mutations and `executed`
  become visible together
- reject requests must use a conditional `pending -> rejected` update so they
  cannot race a successful approval; scope it by `id`, `userId`,
  `status = 'pending'`, and `expiresAt > now`, then reclassify a zero-row result
  using the expiry/status rule above
- when stale, return the new authoritative state and regenerate only through a
  new logical chat request with a new client-generated `requestId`; the new
  request follows the same single draft-creation path
- execution must be idempotent: already executed drafts cannot run again
- interpret natural-language dates and date-only due dates in
  `America/Toronto`; store a date-only due date at noon Toronto time to avoid
  daylight-saving boundary shifts
- pending drafts expire at the instant `createdAt + 24 hours`; timezone is not
  involved in this duration calculation

Suggested status flow:
- `pending -> executing -> executed` inside one transaction (record `approved`
  in the audit log when the user approves)
- `pending -> rejected`
- `pending -> expired`
- `pending -> stale` after a stale execution transaction rolls back
- `pending -> failed` after a failed execution transaction rolls back

Failed (including unsupported-version), stale, expired, and rejected drafts are
terminal. Never retry them in place; re-read authoritative state and create a
new draft with a new payload, draft ID, and `requestId`.

### Authorization boundary

Every read tool, every draft lookup, and every execution path must be scoped by
`userId`.

Rules:
- only load tasks belonging to the authenticated user
- only approve/reject/execute drafts belonging to the authenticated user
- continue using the existing ownership checks in
  [src/lib/auth/db.ts](src/lib/auth/db.ts)

### Chat memory boundary

Chat history should be treated as **intent context**, not authoritative task
state.

Rules:
- store conversation locally on the client if desired (for example
  IndexedDB/local storage)
- do not rely on chat history as the source of truth for tasks
- task state always comes from DB-backed tools
- local chat persistence is orthogonal to server-side pending-action storage

### Create-task minimum fields

When drafting `add_task`, use the existing task schema/validation rules and
require the minimum fields needed by the real data model.

At minimum, v1 should assume:
- `courseId`
- `title`
- `dueDate`

Use the existing task defaults from
[task-draft.ts](src/lib/utils/task/task-draft.ts): `TODO` status, `theorie`
type, and estimated effort `3`. Validate the existing status/type enums and
valid dates before saving a draft. Everything else remains optional unless the
existing schema requires more.

### Retrieval budget

Keep retrieval cheap without losing task identity:
- always return task id, title, course, due date, status, and `updatedAt`
- apply a total character budget to task `notes`/descriptions, rather than a
  task-count-only limit
- if the notes budget is exceeded, return compact task summaries first and load
  full notes only for the candidate tasks selected by the planner

### Audit / observability

Log these events:
- draft created
- draft approved
- draft rejected
- execution started
- execution succeeded
- execution failed
- draft marked stale and regenerated through a new request

Keep the log payload small but include:
- `userId`
- `draftId`
- action counts
- result status

### Verification for this feature

- user asks to add a task; model returns a pending `add_task` draft instead of
  mutating immediately
- user names a course by code/name, including an empty course;
  `search_courses(...)` resolves the owned `courseId`
- user asks to change a due date; model reads the right task first, then
  produces a pending `update_task` draft
- user asks to change multiple tasks; model may produce one batch draft with
  multiple actions
- `get_related_tasks(...)` surfaces neighboring-task warnings and clarification
  choices but never adds an unrequested action
- user asks to delete a task; UI shows an approval preview before deletion
- a failed provider attempt, invalid planner output, or uncommitted/rolled-back
  insert creates no draft
- a committed insert followed by disconnect and retry with the same `requestId`
  returns the same draft and creates no duplicate
- SSE never emits partial text from a provider that is later discarded, and a
  mutation stream never emits raw/partial action JSON
- reject path leaves DB unchanged
- approve path executes via the existing task functions and returns the updated
  authoritative state
- two concurrent approvals result in exactly one committed batch
- a simulated crash/error before commit leaves all tasks unchanged and does
  not leave the draft committed as `executing`
- task edits racing approval cannot pass between stale validation and mutation
- if task state changed between draft creation and approval, the draft is marked
  stale and regenerated through a new logical request
- an expired draft transitions once on access; approve/reject returns
  `DRAFT_EXPIRED` and leaves tasks unchanged
- approving an already executed batch is rejected and does not run twice
