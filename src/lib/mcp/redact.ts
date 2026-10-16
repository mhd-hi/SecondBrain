/**
 * MCP-sensitive value redaction (plan section 19.2 / 21.10): bearer tokens,
 * approval capabilities, and raw tool arguments must never reach Sentry.
 * Extracted here so the rules are unit-testable independent of Sentry.
 */

const REDACTED = '[REDACTED]';

const SECRET_KEY_PATTERN =
  /^(?:authorization|proxy-authorization|cookie|set-cookie|approve|arguments|approvalCapability|capability|access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|app[_-]?key|client[_-]?secret|secret|password|passwd|db\.user|database[_-]?user|webhook[_-]?(?:secret|url))$/i;

const BEARER_PATTERN = /(Bearer|Basic)\s+\w[.\w~+/=-]*/gi;

const JSON_SECRET_PATTERN =
  /"(?:approvalCapability|capability|access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|app[_-]?key|client[_-]?secret|secret|password|passwd|authorization|cookie|set-cookie)"\s*:\s*"(?:\\.|[^"\\])*"/gi;

const SECRET_VALUE_PATTERN =
  /((?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|approval[_-]?capability|capability|token|api[_-]?key|app[_-]?key|client[_-]?secret|secret|password|passwd|cookie)\s*[=:]\s*(?:(?:Bearer|Basic)\s+)?)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s&,;"']+)/gi;

export function redactMcpSecrets(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(BEARER_PATTERN, `$1 ${REDACTED}`)
      .replace(JSON_SECRET_PATTERN, `"${REDACTED}"`)
      .replace(SECRET_VALUE_PATTERN, `$1${REDACTED}`)
      .replace(/\bsb_mcp_[\w-]+/g, REDACTED)
      .replace(/\b(?:sk-|ghp_|github_pat_|phc_|hf_)[\w-]+/g, REDACTED)
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, REDACTED)
      .replace(/https?:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s/?#]+\/[^\s?#]+/gi, REDACTED)
      .replace(/(https?:\/\/)[^\s/:@]+:[^\s/@]+@/gi, `$1${REDACTED}@`);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactMcpSecrets(item));
  }
  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SECRET_KEY_PATTERN.test(key)) {
        redacted[key] = REDACTED;
      } else {
        redacted[key] = redactMcpSecrets(entry);
      }
    }
    return redacted;
  }
  return value;
}
