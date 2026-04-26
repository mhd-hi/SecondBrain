import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';

export type AuthenticatedUser = {
  id: string;
  email?: string;
  name?: string;
};

async function captureException(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const Sentry = await import('@sentry/core');
  Sentry.captureException(error, context);
}

// Get the authenticated user from the server-side session.
async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const session = await auth();
    if (session?.user?.id) {
      return {
        id: session.user.id,
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting authenticated user:', error);

    // Check if it's a database connection issue
    const errorMessage = error instanceof Error ? error.message : '';
    const isDatabaseIssue = errorMessage.includes('timeout')
      || errorMessage.includes('ETIMEDOUT')
      || errorMessage.includes('connect')
      || errorMessage.includes('ECONNREFUSED');

    console.error(errorMessage);
    await captureException(error, {
      tags: {
        context: 'auth',
        function: 'getAuthenticatedUser',
        isDatabaseIssue: isDatabaseIssue ? 'yes' : 'no',
      },
    });
    return null;
  }
}

/**
 * Require authentication and return user or throw error
 */
async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  return user;
}

/**
 * Custom error classes for better error handling
 */
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Standard error responses
 */
function createAuthErrorResponse(error: Error): NextResponse {
  const errorMessage = error.message || '';
  const isDatabaseIssue = errorMessage.includes('timeout')
    || errorMessage.includes('ETIMEDOUT')
    || errorMessage.includes('connect')
    || errorMessage.includes('ECONNREFUSED');

  if (error instanceof AuthenticationError) {
    // Provide better error message if database is likely paused
    const message = isDatabaseIssue
      ? 'Database is warming up. Please wait a moment and try again.'
      : error.message;

    return NextResponse.json(
      { error: message, code: 'UNAUTHENTICATED', retry: isDatabaseIssue },
      { status: 401 },
    );
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message, code: 'UNAUTHORIZED' },
      { status: 403 },
    );
  }

  // Generic error with database hint
  const message = isDatabaseIssue
    ? 'Database connection issue. Please try again in a moment.'
    : 'Internal server error';

  return NextResponse.json(
    { error: message, code: 'INTERNAL_ERROR', retry: isDatabaseIssue },
    { status: 500 },
  );
}

/**
 * Higher-order function to wrap API routes with authentication
 */
export function withAuth<TParams = Record<string, string>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<TParams>; user: AuthenticatedUser },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    try {
      const user = await requireAuth();
      return await handler(request, { ...context, user });
    } catch (error) {
      console.error('Authentication error in API route:', error);
      await captureException(error, {
        tags: { context: 'auth', function: 'withAuth' },
        extra: { route: request.url },
      });
      return createAuthErrorResponse(error as Error);
    }
  };
}

/**
 * Higher-order function for simple authenticated API routes (no params)
 * This is a convenience wrapper around withAuth for routes without dynamic params
 * TODO: replace all usages with `withAuth` later
 */
export function withAuthSimple(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
) {
  return withAuth<Record<string, never>>(async (request, { user }) => {
    return handler(request, user);
  });
}
