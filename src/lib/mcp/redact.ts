/**
 * MCP-sensitive value redaction (plan section 19.2 / 21.10): bearer tokens,
 * approval capabilities, and raw tool arguments must never reach Sentry.
 * Extracted here so the rules are unit-testable independent of Sentry.
 */

const REDACTED = '[REDACTED]';

const SECRET_KEY_PATTERN =
  /^(?:authorization|approve|arguments|approvalCapability|capability|accessToken|access_token|refresh_token)$/i;

const BEARER_PATTERN = /Bearer\s+\w[.\w~+/=-]*/gi;

const JSON_SECRET_PATTERN =
  /"(?:approvalCapability|capability|accessToken|access_token|refresh_token|authorization)"\s*:\s*"[^"]*"/gi;

export function redactMcpSecrets(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
      .replace(JSON_SECRET_PATTERN, `"${REDACTED}"`);
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
