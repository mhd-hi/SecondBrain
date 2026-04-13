import type { DefaultSession, NextAuthConfig } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import { env } from '@/env';

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module 'next-auth' {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Session {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession['user'];
  }
}

export const authProviders = [
  GoogleProvider({
    clientId: env.AUTH_GOOGLE_ID,
    clientSecret: env.AUTH_GOOGLE_SECRET,
  }),
  DiscordProvider({
    clientId: env.AUTH_DISCORD_ID,
    clientSecret: env.AUTH_DISCORD_SECRET,
  }),
] satisfies NextAuthConfig['providers'];

export const authCallbacks = {
  session: ({ session, user, token }) => ({
    ...session,
    user: {
      ...session.user,
      // For database sessions, use user.id; for JWT sessions use token.sub.
      id: user?.id ?? token?.sub ?? session.user?.id,
    },
  }),
  jwt: ({ token, user }) => {
    if (user) {
      token.sub = user.id;
    }

    return token;
  },
  signIn: async () => {
    return true;
  },
} satisfies NextAuthConfig['callbacks'];

export const authPages = {
  signIn: '/auth/signin',
  error: '/auth/error',
} satisfies NextAuthConfig['pages'];

export const sharedAuthConfig = {
  trustHost: true,
  providers: authProviders,
  callbacks: authCallbacks,
  pages: authPages,
} satisfies Partial<NextAuthConfig>;
