import NextAuth from 'next-auth';
import { sharedAuthConfig } from '@/server/auth/shared-config';

const { auth: middleware } = NextAuth({
  ...sharedAuthConfig,
  session: { strategy: 'jwt' },
  callbacks: {
    ...sharedAuthConfig.callbacks,
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // Public pages and non-session endpoints (handled per-route).
      if (
        pathname.startsWith('/auth/')
        || pathname.startsWith('/api/auth')
        || pathname.startsWith('/api/cron')
        || pathname.startsWith('/api/mcp')
        || pathname.startsWith('/miaow')
        || pathname === '/'
        || pathname === '/terms'
        || pathname === '/privacy'
      ) {
        return true;
      }
      return !!auth?.user?.id;
    },
  },
});

export default middleware;

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|assets|auth/|miaow).*)',
  ],
};
