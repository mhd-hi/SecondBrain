import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/lib/page-routes';
import { normalizeCallbackUrl, resolveCallbackUrl } from '@/lib/utils/auth/callback-url';

describe('callback URL normalization', () => {
  it('keeps safe internal relative paths', () => {
    expect(normalizeCallbackUrl('/courses/123?view=week#task-1')).toBe('/courses/123?view=week#task-1');
  });

  it('normalizes same-origin absolute URLs back to internal paths', () => {
    expect(
      normalizeCallbackUrl('https://app.example.com/calendar?view=month', {
        baseUrl: 'https://app.example.com',
      }),
    ).toBe('/calendar?view=month');
  });

  it('rejects external callback URLs', () => {
    expect(
      normalizeCallbackUrl('https://evil.example.com/phish', {
        baseUrl: 'https://app.example.com',
      }),
    ).toBe(ROUTES.DASHBOARD);
  });

  it('rejects protocol-relative callback URLs', () => {
    expect(normalizeCallbackUrl('//evil.example.com/phish')).toBe(ROUTES.DASHBOARD);
  });

  it('resolves redirects against the trusted auth base URL', () => {
    expect(resolveCallbackUrl('/preferences?view=profile', 'https://app.example.com')).toBe(
      'https://app.example.com/preferences?view=profile',
    );
  });
});
