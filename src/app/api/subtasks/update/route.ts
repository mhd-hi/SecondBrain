import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api';
import { db } from '@/server/db';
import { subtasks, tasks } from '@/server/db/schema';

export async function handleSubtaskUpdatePost(req: NextRequest, user: { id: string }) {
  try {
    const { id, input, value } = await req.json();
    // Only allow updating specific fields for subtasks
    const allowedFields = ['title', 'notes', 'status', 'estimatedEffort', 'dueDate'];
    if (!allowedFields.includes(input)) {
      return NextResponse.json({ success: false, error: 'Invalid field' }, { status: 400 });
    }

    // Verify subtask exists and belongs to a task owned by the user
    const sub = await db.select().from(subtasks).where(eq(subtasks.id, id)).limit(1);
    if (!sub.length) {
      return NextResponse.json({ success: false, error: 'Subtask not found' }, { status: 404 });
    }
    const sub0 = sub[0]!;

    const parentTask = await db.select().from(tasks).where(eq(tasks.id, sub0.taskId)).limit(1);
    if (!parentTask.length || parentTask[0]!.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // sanitize numeric fields for subtasks
    let sanitizedValue: unknown = value;
    if (input === 'estimatedEffort') {
      const num = Number(value);
      sanitizedValue = Number.isFinite(num) ? (num < 0 ? 0.5 : Math.max(0, num)) : 0.5;
    }

    // Perform update
    const updated = await db.update(subtasks)
      .set({ [input]: sanitizedValue, updatedAt: new Date() } as Partial<typeof subtasks.$inferInsert>)
      .where(and(eq(subtasks.id, id), eq(subtasks.taskId, sub0.taskId)))
      .returning();

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errMsg || 'Unknown error' }, { status: 400 });
  }
}

export const POST = withAuth(async (req, { user }) => handleSubtaskUpdatePost(req, user));
