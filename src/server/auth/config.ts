import type { NextAuthConfig } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/server/db';
import { AUTH_SESSION_MAX_AGE_SECONDS } from './session-contract';
import { sharedAuthConfig } from './shared-config';

/**
 * Full configuration with database adapter (for main app)
 */
export const authConfig = {
  ...sharedAuthConfig,
  adapter: DrizzleAdapter(db),
  session: {
    strategy: 'jwt',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  },
  debug: process.env.NODE_ENV === 'development',
} satisfies NextAuthConfig;
