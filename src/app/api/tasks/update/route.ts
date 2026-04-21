import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { db } from '@/server/db';
import { tasks } from '@/server/db/schema';

export async function handleTaskUpdatePost(req: NextRequest, user: { id: string }) {
  try {
    const { taskId, input, value } = await req.json();
    const allowedFields = ['title', 'notes', 'status', 'estimatedEffort', 'actualEffort', 'dueDate', 'type'];

    if (!allowedFields.includes(input)) {
      console.error('Invalid field while updating task, field: ', input);
      return NextResponse.json({ success: false, error: 'Invalid field' }, { status: 400 });
    }

    const updateObj: Partial<typeof tasks.$inferSelect> = {};

    if (input === 'dueDate') {
      (updateObj as unknown as Record<string, unknown>)[input] = new Date(value);
    } else if (input === 'estimatedEffort' || input === 'actualEffort') {
      // sanitize numeric fields: coerce to number; if negative default to 0.5, otherwise clamp to >= 0
      const num = Number(value);
      const safe = Number.isFinite(num) ? (num < 0 ? 0.5 : Math.max(0, num)) : 0.5;
      (updateObj as unknown as Record<string, unknown>)[input] = safe;
    } else {
      (updateObj as unknown as Record<string, unknown>)[input] = value;
    }

    updateObj.updatedAt = new Date();

    try {
      const result = await db.update(tasks)
        .set(updateObj as Partial<typeof tasks.$inferInsert>)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
        .returning();

      if (!result.length) {
        return NextResponse.json({ success: false, error: 'Task not found or access denied' }, { status: 404 });
      }

      return NextResponse.json({ success: true, taskId, input, value, updated: result });
    } catch (dbErr) {
      console.error('DB update error:', dbErr);
      const dbErrMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      return NextResponse.json({ success: false, error: dbErrMsg || 'Unknown DB error' }, { status: 400 });
    }
  } catch (err) {
    console.error('API error:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errMsg || 'Unknown error' }, { status: 400 });
  }
}

export const POST = withAuthSimple(handleTaskUpdatePost);
