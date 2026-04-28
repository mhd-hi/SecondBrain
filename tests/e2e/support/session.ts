import type { BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  getAuthSessionCookieName,
} from '@/server/auth/session-contract';
import type { E2ETestUser } from './test-user';

const DEFAULT_BASE_URL = `http://127.0.0.1:${process.env.PORT ?? '3000'}`;

function getBaseURL() {
  return process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function installAuthenticatedSession(context: BrowserContext, user: E2ETestUser) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET is required to create the Playwright session cookie.');
  }

  const baseURL = getBaseURL();
  const cookieName = getAuthSessionCookieName(baseURL);
  const maxAge = AUTH_SESSION_MAX_AGE_SECONDS;
  const expires = new Date(Date.now() + maxAge * 1000);

  const sessionToken = await encode({
    secret,
    salt: cookieName,
    maxAge,
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
    },
  });

  await context.addCookies([
    {
      name: cookieName,
      value: sessionToken,
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(baseURL).protocol === 'https:',
      expires: Math.floor(expires.getTime() / 1000),
    },
  ]);
}
