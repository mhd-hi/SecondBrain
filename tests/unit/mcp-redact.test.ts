import { describe, expect, it } from 'vitest';
import { redactMcpSecrets } from '@/lib/mcp/redact';

describe('MCP secret redaction (plan 21.10)', () => {
  it('redacts standalone MCP API keys and unquoted approval capabilities', () => {
    const input =
      'issued sb_mcp_abcdefghijklmnopqrstuvwxyz0123456789 approvalCapability=raw-capability-value';
    const result = String(redactMcpSecrets(input));

    expect(result).not.toContain('sb_mcp_');
    expect(result).not.toContain('raw-capability-value');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts database usernames from OpenTelemetry span attributes', () => {
    const result = redactMcpSecrets({ 'db.user': 'database-user' }) as Record<
      string,
      unknown
    >;

    expect(result['db.user']).toBe('[REDACTED]');
  });

  it('masks general telemetry secrets, URL credentials, and short/quoted values', () => {
    const event = {
      message: 'password="private password" api_key=short https://api.test/?app_key=query-private https://discord.com/api/webhooks/1/webhook-private https://user:basic-private@api.test',
      attributes: { password: 'attribute-private', nested: [{ apiKey: 'nested-private', status: 500 }] },
    };
    const result = JSON.stringify(redactMcpSecrets(event));
    for (const secret of ['private password', 'short', 'query-private', 'webhook-private', 'basic-private', 'attribute-private', 'nested-private']) {
      expect(result).not.toContain(secret);
    }

    expect(result).toContain('500');
    expect(redactMcpSecrets('Authorization: Basic private-credential')).not.toContain('private-credential');
    expect(redactMcpSecrets('eyJfake-header.payload.signature')).toBe('[REDACTED]');
  });

  it('redacts bearer tokens in strings', () => {
    expect(
      redactMcpSecrets('Authorization=Bearer eyJhbGciOiJIUzI1NiJ9.abc.def'),
    ).toBe('Authorization=Bearer [REDACTED]');
  });

  it('redacts JSON-serialized capabilities and tokens in strings', () => {
    const input =
      'payload {"approvalCapability":"raw-secret-value","other":1} end';

    expect(redactMcpSecrets(input)).toBe(
      'payload {"[REDACTED]","other":1} end',
    );
  });

  it('redacts whole values under secret keys in objects, nested arbitrarily', () => {
    const event = {
      request: {
        headers: { authorization: 'Bearer abc.def' },
      },
      extra: {
        arguments: { title: 'x', dueDate: '2026-01-01' },
        approvalCapability: 'top-secret-capability',
      },
      harmless: 'keep me',
    };
    const result = redactMcpSecrets(event) as Record<string, unknown>;
    const request = result.request as Record<string, unknown>;
    const headers = request.headers as Record<string, unknown>;

    expect(headers.authorization).toBe('[REDACTED]');

    const extra = result.extra as Record<string, unknown>;

    expect(extra.approvalCapability).toBe('[REDACTED]');
    expect(extra.arguments).toBe('[REDACTED]');
    expect(result.harmless).toBe('keep me');
  });

  it('redacts inside arrays', () => {
    const result = redactMcpSecrets([
      'Bearer token-here',
      { capability: 'x' },
      42,
      null,
    ]) as unknown[];

    expect(result[0]).toBe('Bearer [REDACTED]');
    expect(result[1]).toEqual({ capability: '[REDACTED]' });
    expect(result[2]).toBe(42);
    expect(result[3]).toBeNull();
  });

  it('leaves primitives other than strings untouched', () => {
    expect(redactMcpSecrets(123)).toBe(123);
    expect(redactMcpSecrets(true)).toBe(true);
    expect(redactMcpSecrets(null)).toBeNull();
    expect(redactMcpSecrets(undefined)).toBeUndefined();
  });

  it('does not mutate the input object', () => {
    const event = { capability: 'secret', nested: { arguments: 'raw' } };
    redactMcpSecrets(event);

    expect(event.capability).toBe('secret');
    expect((event.nested as Record<string, unknown>).arguments).toBe('raw');
  });

  it('handles cyclic Sentry event objects without overflowing', () => {
    const event: { context?: { parent?: unknown }; token: string } = {
      token: 'sensitive',
    };
    event.context = { parent: event };

    expect(redactMcpSecrets(event)).toEqual({
      token: '[REDACTED]',
      context: { parent: '[Circular]' },
    });
  });

  it('covers a realistic Sentry event shape end to end', () => {
    const event = {
      exception: { values: [{ value: 'Bearer eyJ.abc failed' }] },
      request: { headers: { Authorization: 'Bearer eyJ.sig' } },
      tags: { toolName: 'prepare_task_changes' },
      extra: {
        toolArguments: JSON.stringify({
          approvalCapability: 'cap-raw-value',
          draftId: 'd1',
        }),
      },
    };
    // eslint-disable-next-line ts/no-explicit-any
const result = redactMcpSecrets(event) as any;

    expect(
      result.exception.values[0].value,
    ).toBe('Bearer [REDACTED] failed');
    expect(result.request.headers.Authorization).toBe('[REDACTED]');
    expect(result.tags.toolName).toBe('prepare_task_changes');
    expect(result.extra.toolArguments).not.toContain('cap-raw-value');
    expect(result.extra.toolArguments).toContain('[REDACTED]');
  });
});
