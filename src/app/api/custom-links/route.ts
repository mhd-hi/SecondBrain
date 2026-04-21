import type { NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { AuthorizationError, withAuth } from '@/lib/auth/api';
import { assertUserOwnsCourse } from '@/lib/auth/db';
import { statusResponse } from '@/lib/utils/api/api-server-util';
import { validateUrl } from '@/lib/utils/url-util';
import { db } from '@/server/db';
import { customLinks } from '@/server/db/schema';
import { LINK_TYPES } from '@/types/custom-link';

function validateAndNormalizeUrl(raw: unknown) {
  if (typeof raw !== 'string') {
    throw new TypeError('Invalid url, should be a string');
  }

  const s = raw.trim();
  if (!s) {
    throw new TypeError('Empty url');
  }

  if (!validateUrl(s)) {
    throw new TypeError('Invalid url format, should contain at least one dot');
  }

  return s;
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    const url = new URL(req.url);
    const courseId = url.searchParams.get('courseId');

    let rows;
    if (courseId) {
      rows = await db.select().from(customLinks).where(and(eq(customLinks.courseId, courseId), eq(customLinks.userId, user.id)));
    } else {
      // dashboard/global links belong to the user and have null courseId
      rows = await db.select().from(customLinks).where(and(eq(customLinks.userId, user.id), sql`${customLinks.courseId} IS NULL`));
    }

    const response = statusResponse({ success: true, customLinks: rows });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
});

// POST: create a new link for the authenticated user
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const body = await req.json();
    const { title, url, type = LINK_TYPES.CUSTOM, courseId } = body ?? {};

    if (!title || !url) {
      return NextResponse.json({ success: false, error: 'Missing title or url' }, { status: 400 });
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = validateAndNormalizeUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid url';
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    if (courseId) {
      await assertUserOwnsCourse(courseId, user.id);
    }

    const inserted = await db.insert(customLinks).values({
      title,
      url: normalizedUrl,
      type,
      userId: user.id,
      courseId: courseId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return statusResponse({ success: true, customLink: inserted[0] });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      throw err;
    }

    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  try {
    const url = new URL(req.url);
    const courseId = url.searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Missing courseId' }, { status: 400 });
    }

    // Delete all links belonging to the user for this course
    const deletedLinks = await db.delete(customLinks)
      .where(and(eq(customLinks.courseId, courseId), eq(customLinks.userId, user.id)))
      .returning();

    return statusResponse({
      success: true,
      deletedCount: deletedLinks.length,
      message: `Deleted ${deletedLinks.length} link${deletedLinks.length !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
});
