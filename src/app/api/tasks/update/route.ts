import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthSimple } from '@/lib/auth/api';
import { db } from '@/server/db';
import { tasks } from '@/server/db/schema';
import { StatusTask } from '@/types/status-task';
import { TASK_TYPES } from '@/types/task';

const numericEffort = z.preprocess((value) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0.5;
}, z.number().min(0));

const TaskTypeSchema = z.enum([
  TASK_TYPES.THEORIE,
  TASK_TYPES.PRATIQUE,
  TASK_TYPES.EXAM,
  TASK_TYPES.HOMEWORK,
  TASK_TYPES.LAB,
]);

const taskUpdateSchema = z.discriminatedUnion('input', [
  z.object({ taskId: z.string().min(1), input: z.literal('title'), value: z.string() }),
  z.object({ taskId: z.string().min(1), input: z.literal('notes'), value: z.string() }),
  z.object({ taskId: z.string().min(1), input: z.literal('status'), value: z.nativeEnum(StatusTask) }),
  z.object({ taskId: z.string().min(1), input: z.literal('estimatedEffort'), value: numericEffort }),
  z.object({ taskId: z.string().min(1), input: z.literal('actualEffort'), value: numericEffort }),
  z.object({
    taskId: z.string().min(1),
    input: z.literal('dueDate'),
    value: z.preprocess((value) => {
      if (value instanceof Date) {
        return value;
      }
      if (typeof value === 'string' || typeof value === 'number') {
        return new Date(value);
      }
      return value;
    }, z.date()),
  }),
  z.object({ taskId: z.string().min(1), input: z.literal('type'), value: TaskTypeSchema }),
]);

export async function handleTaskUpdatePost(req: NextRequest, user: { id: string }) {
  try {
    const parsed = taskUpdateSchema.safeParse(await req.json());

    if (!parsed.success) {
      const invalidFieldIssue = parsed.error.issues.some(issue => issue.path[0] === 'input');
      return NextResponse.json(
        { success: false, error: invalidFieldIssue ? 'Invalid field' : 'Invalid request payload' },
        { status: 400 },
      );
    }

    const { taskId, input, value } = parsed.data;
    const updateObj: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

    switch (input) {
      case 'dueDate':
        updateObj.dueDate = value;
        break;
      case 'estimatedEffort':
        updateObj.estimatedEffort = value;
        break;
      case 'actualEffort':
        updateObj.actualEffort = value;
        break;
      case 'status':
        updateObj.status = value;
        break;
      case 'title':
        updateObj.title = value;
        break;
      case 'notes':
        updateObj.notes = value;
        break;
      case 'type':
        updateObj.type = value;
        break;
    }

    try {
      const result = await db.update(tasks)
        .set(updateObj)
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
