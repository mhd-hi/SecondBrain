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

  it('trims whitespace around safe internal callback URLs', () => {
    expect(normalizeCallbackUrl('   /courses/123?view=week   ')).toBe('/courses/123?view=week');
  });

  it('rejects encoded protocol-relative internal callback URLs', () => {
    expect(normalizeCallbackUrl('/%2f%2fevil.com/phish')).toBe(ROUTES.DASHBOARD);
  });

  it('does not unwrap nested redirect parameters from same-origin callback URLs', () => {
    expect(
      normalizeCallbackUrl(
        'https://app.example.com/auth/signin?callbackUrl=https://evil.example.com/phish',
        { baseUrl: 'https://app.example.com' },
      ),
    ).toBe('/auth/signin?callbackUrl=https://evil.example.com/phish');
  });

  it('rejects callback URLs with malformed absolute origins', () => {
    expect(
      normalizeCallbackUrl('https://app.example.com@evil.example.com/phish', {
        baseUrl: 'https://app.example.com',
      }),
    ).toBe(ROUTES.DASHBOARD);
  });

  it('resolves redirects against the trusted auth base URL', () => {
    expect(resolveCallbackUrl('/preferences?view=profile', 'https://app.example.com')).toBe(
      'https://app.example.com/preferences?view=profile',
    );
  });

  it('keeps resolved redirects on the trusted origin when nested callback params are present', () => {
    expect(
      resolveCallbackUrl(
        'https://app.example.com/auth/signin?callbackUrl=https://evil.example.com/phish',
        'https://app.example.com',
      ),
    ).toBe('https://app.example.com/auth/signin?callbackUrl=https://evil.example.com/phish');
  });
});
