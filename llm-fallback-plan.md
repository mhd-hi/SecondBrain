i need 2 models in NVIDIA.
# Multi-model LLM fallback for course-plan → task generation

## Context

`second-brain` already has a working AI pipeline that turns a scraped course-plan
page into weekly tasks: [src/lib/ai/openai.ts](src/lib/ai/openai.ts) builds a prompt
([prompt.ts](src/lib/ai/prompt.ts)), calls OpenAI via
[call.ts](src/lib/ai/call.ts) → [client.ts](src/lib/ai/client.ts), and parses the
response text into a JSON array ([parse.ts](src/lib/ai/parse.ts)) — tolerant of
non-strict-JSON output (regex/bracket extraction, no dependency on OpenAI's
`response_format: json_object`). This whole chain runs behind a single hardcoded
provider (`OPENAI_API_KEY`), so if that key runs out of quota or OpenAI has an
outage, course import breaks entirely.

The user wants the same **sequential provider fallback** pattern used in
`planifETS-backend/src/llm-generation` (`LlmService`: ordered provider list, try
each in turn, skip providers with no configured API key, throw only once every
provider has failed) applied here — using **free-tier LLM APIs** as the primary
chain so course-plan parsing basically never goes down, with paid OpenAI as a
last-resort safety net if configured.

Unlike the inspiration repo, we don't need hand-rolled `fetch`-based provider
classes: Groq, Gemini, Cerebras, and OpenRouter all expose **OpenAI-compatible
`/chat/completions` endpoints**, and the `openai` SDK is already a dependency
here and already supports a custom `baseURL`. So the fallback chain is just "try
the OpenAI SDK against N different `{baseURL, apiKey, model}` configs in order,"
not a new client architecture. Because `parseContentWithAI` already tolerates
loose text output (no JSON-mode requirement), no provider-specific response
handling is needed either — this is the key simplification versus the
inspiration codebase.

Provider order (free tiers first, verified current as of 2026-07, rate limits
change so treat as a starting point): **Groq (Llama 3.3 70B, ~30 RPM/1000 RPD
free) → Google AI Studio (Gemini 2.5 Flash, ~1500 req/day free, no credit card)
→ Cerebras (~1M tokens/day free) → NVIDIA NIM (free API catalog access,
generous per-model limits) → OpenRouter free-tier models (broad net of ~20
free models, one more layer of redundancy) → OpenAI (paid, only used if all
free options are exhausted/unset)**. Google AI Studio *is* the free Gemini API
key (`generativelanguage.googleapis.com`) — it's listed as its own named
provider since that's the product the key is issued from. Each entry is
skipped if its API key env var isn't set, matching the inspiration repo's
`tryProvider` behavior — so this works even if the user only adds 1-2 of the
keys.

Model choice per provider is pulled from **one small `PROVIDER_MODELS` map at
the top of `providers.ts`** (see below) — swapping a model (e.g. Groq drops
`llama-3.3-70b-versatile` for a newer one) is a one-line edit in one place,
no env var or redeploy config needed. Endpoint URLs and key lookup stay
separate below it since those rarely change, keeping the "thing you'll
actually want to tweak often" isolated from the rest.

## Implementation

**1. New file `src/lib/ai/providers.ts`** — ordered provider config list built
from env, filtering out entries with no API key:

```ts
type ProviderConfig = { name: string; apiKey: string; baseURL: string; model: string };

// Change a model here — nowhere else. One line per provider.
const PROVIDER_MODELS = {
  groq: 'llama-3.3-70b-versatile',
  'google-ai-studio': 'gemini-2.5-flash',
  cerebras: 'llama-3.3-70b',
  nvidia: 'meta/llama-3.3-70b-instruct',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  openai: 'gpt-4o-mini',
} as const;

function buildProviders(): ProviderConfig[] {
  return [
    env.GROQ_API_KEY && { name: 'groq', apiKey: env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1', model: PROVIDER_MODELS.groq },
    env.GOOGLE_AI_STUDIO_API_KEY && { name: 'google-ai-studio', apiKey: env.GOOGLE_AI_STUDIO_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: PROVIDER_MODELS['google-ai-studio'] },
    env.CEREBRAS_API_KEY && { name: 'cerebras', apiKey: env.CEREBRAS_API_KEY, baseURL: 'https://api.cerebras.ai/v1', model: PROVIDER_MODELS.cerebras },
    env.NVIDIA_API_KEY && { name: 'nvidia', apiKey: env.NVIDIA_API_KEY, baseURL: 'https://integrate.api.nvidia.com/v1', model: PROVIDER_MODELS.nvidia },
    env.OPENROUTER_API_KEY && { name: 'openrouter', apiKey: env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1', model: PROVIDER_MODELS.openrouter },
    env.OPENAI_API_KEY && { name: 'openai', apiKey: env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', model: PROVIDER_MODELS.openai },
  ].filter(Boolean) as ProviderConfig[];
}
```

Reordering the fallback chain is equally cheap: it's just the array literal
order above — move a line to change priority, comment one out to disable a
provider without touching env vars.

**2. `src/lib/ai/client.ts`** — replace the single `getOpenAIClient()` singleton
with a small per-provider client cache (`Map<string, OpenAI>`), keyed by
provider name, constructing `new OpenAI({ apiKey, baseURL })` lazily.

**3. `src/lib/ai/call.ts`** — replace `callOpenAI` with `callWithFallback(messages)`
that iterates `buildProviders()` in order, calling `openai.chat.completions.create`
against each; on any thrown error (HTTP error, timeout, empty response), log via
`console.warn` (matches this file's existing plain-console style — no new
telemetry framework) and continue to the next provider. If the whole list is
exhausted (including the case where it's empty because no keys are set at all),
throw one `Error('All AI providers failed or are unconfigured')` with the last
error as `cause`. Keep the existing per-call shape (`{text, usage, model,
finish_reason}`) so callers don't change.

**4. `src/lib/ai/openai.ts`** — swap the `callOpenAI(...)` call for
`callWithFallback(...)`; no other changes (prompt building, JSON extraction,
Sentry logging, and the return shape all stay identical).

**5. `src/env.js`** — add `GROQ_API_KEY`, `GOOGLE_AI_STUDIO_API_KEY`,
`CEREBRAS_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY` as
`z.string().optional()` in `server`, wired into `runtimeEnv`, same pattern as
the existing optional `OPENAI_API_KEY`.

**6. `.env.example`** — add the five new keys under the existing `# AI Services`
section (line 19 area), each defaulting to `""`.

Files intentionally **not** touched: [registry.ts](src/lib/ai/registry.ts) and
[config.ts](src/lib/ai/config.ts) (the `openai` provider name there refers to
the course-parsing *strategy*, a separate layer from the raw-model fallback
chain — no change needed), [prompt.ts](src/lib/ai/prompt.ts) and
[parse.ts](src/lib/ai/parse.ts) (already model-agnostic), and the
`course-pipeline` route / task-creation flow (unaffected — fallback is fully
internal to `callWithFallback`).

## Verification

- Add `tests/unit/ai-call-fallback.test.ts`, following this repo's existing
  flat `tests/unit/*.test.ts` convention (e.g.
  [tests/unit/course-pipeline-route.test.ts](tests/unit/course-pipeline-route.test.ts))
  rather than a co-located `__tests__` folder. Using Vitest: mock the `openai`
  SDK's `chat.completions.create` to reject for the first N configured
  providers and resolve for the last, asserting `callWithFallback` returns the
  successful result and that all prior providers were attempted.
- Manually verify: set only `GROQ_API_KEY` (unset `OPENAI_API_KEY`), run the
  existing course-import flow end-to-end (`/api/course-pipeline` step `ai`)
  against a real or sample course-plan HTML, confirm tasks are generated.
- Then unset `GROQ_API_KEY` too (simulate exhaustion/outage) and confirm the
  chain correctly falls through to the next configured key, and that with zero
  keys configured it throws the clear "all providers failed or unconfigured"
  error instead of a confusing per-provider stack trace.
