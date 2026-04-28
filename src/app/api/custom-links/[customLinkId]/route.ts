import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/api';
import { db } from '@/server/db';
import { customLinks } from '@/server/db/schema';
import { LINK_TYPES } from '@/types/custom-link';
import { normalizeUrl, validateUrl } from '@/lib/utils/url-util';

const linkTypeSchema = z.union([
  z.literal(LINK_TYPES.PLANETS),
  z.literal(LINK_TYPES.MOODLE),
  z.literal(LINK_TYPES.NOTEBOOK_LM),
  z.literal(LINK_TYPES.SPOTIFY),
  z.literal(LINK_TYPES.YOUTUBE),
  z.literal(LINK_TYPES.CHATGPT),
  z.literal(LINK_TYPES.CUSTOM),
]);

const updateCustomLinkSchema = z.object({
  title: z.string().trim().min(1).optional(),
  url: z.string().trim().min(1).optional(),
  type: linkTypeSchema.optional(),
}).refine(data => data.title !== undefined || data.url !== undefined || data.type !== undefined, {
  message: 'No valid fields to update',
});

export const DELETE = withAuth<{ customLinkId: string }>(async (req: NextRequest, { params, user }) => {
  try {
    const { customLinkId } = params as { customLinkId?: string };

    if (!customLinkId) {
      return NextResponse.json({ success: false, error: 'Missing customLinkId' }, { status: 400 });
    }

    const res = await db.delete(customLinks)
      .where(and(eq(customLinks.id, customLinkId), eq(customLinks.userId, user.id)))
      .returning();

    if (!res.length) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
});

export const PATCH = withAuth<{ customLinkId: string }>(async (req: NextRequest, { params, user }) => {
  try {
    const { customLinkId } = params as { customLinkId?: string };

    if (!customLinkId) {
      return NextResponse.json({ success: false, error: 'Missing customLinkId' }, { status: 400 });
    }

    const parsed = updateCustomLinkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request body' }, { status: 400 });
    }

    const { title, url, type } = parsed.data;
    const updates: Partial<typeof customLinks.$inferInsert> = { updatedAt: new Date() };

    if (title !== undefined) {
      updates.title = title;
    }
    if (url !== undefined) {
      try {
        if (!validateUrl(url)) {
          throw new TypeError('Invalid url format');
        }
        updates.url = normalizeUrl(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid url';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }
    if (type !== undefined) {
      updates.type = type;
    }

    const updated = await db.update(customLinks)
      .set(updates)
      .where(and(eq(customLinks.id, customLinkId), eq(customLinks.userId, user.id)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, customLink: updated[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
});
