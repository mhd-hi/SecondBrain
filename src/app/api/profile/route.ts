import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { withAuthSimple } from '@/lib/auth/api';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

const profileSchema = z.strictObject({
  nickname: z.union([
    z.literal(''),
    z.string().regex(/^[a-z\d]{1,15}$/i),
  ]),
});

export const GET = withAuthSimple(async (_request, user) => {
  const [profile] = await db
    .select({ nickname: users.nickname })
    .from(users)
    .where(eq(users.id, user.id));
  return NextResponse.json({ nickname: profile?.nickname ?? '' });
});

export const PATCH = withAuthSimple(async (request, user) => {
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Nickname must contain 1-15 letters or numbers only' },
      { status: 400 },
    );
  }

  const [profile] = await db
    .update(users)
    .set({ nickname: parsed.data.nickname || null })
    .where(eq(users.id, user.id))
    .returning({ nickname: users.nickname });
  return NextResponse.json({ nickname: profile?.nickname ?? '' });
});
