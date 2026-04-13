import type { NextAuthConfig } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/server/db';
import { sharedAuthConfig } from './shared-config';

/**
 * Full configuration with database adapter (for main app)
 */
export const authConfig = {
  ...sharedAuthConfig,
  adapter: DrizzleAdapter(db),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },
  debug: process.env.NODE_ENV === 'development',
} satisfies NextAuthConfig;
