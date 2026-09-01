import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Same-origin protection for browser-authenticated mutation routes (plan
 * section 15): browser approve/reject calls must validate a same-origin
 * Origin header in addition to the authenticated cookie, so a cross-site
 * page cannot trigger draft state changes with the user's cookies.
 *
 * - Requests with no Origin header (same-origin fetches from some browsers,
 *   curl, tests) are allowed through; cookie auth still applies.
 * - Any present Origin that does not match the request origin is rejected
 *   with 403.
 */
export function requireSameOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return null;
  }
  try {
    if (new URL(origin).origin === new URL(request.url).origin) {
      return null;
    }
  } catch {
    // malformed origin falls through to rejection
  }
  return NextResponse.json(
    { error: 'Cross-origin request rejected' },
    { status: 403 },
  );
}

export function isCrossOrigin(request: NextRequest): boolean {
  return requireSameOrigin(request) !== null;
}
