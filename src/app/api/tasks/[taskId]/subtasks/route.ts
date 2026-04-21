import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api';
import { getUserTask } from '@/lib/auth/db';
import { db } from '@/server/db';
import { subtasks } from '@/server/db/schema';

export const POST = withAuth<{ taskId: string }>(
    async (request: NextRequest, { params, user }) => {
        const { taskId } = await params;
        const body = await request.json() as Partial<typeof subtasks.$inferInsert>;

        // Verify parent task ownership using existing helper
        try {
            await getUserTask(taskId, user.id);
        } catch {
            return NextResponse.json({ error: 'Task not found or unauthorized' }, { status: 404 });
        }

        // Insert the new subtask
        const toInsert: typeof subtasks.$inferInsert = {
            id: body.id ?? crypto.randomUUID(),
            taskId,
            title: body.title ?? '',
            notes: body.notes ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.insert(subtasks).values(toInsert).returning();
        const created = result[0];

        return NextResponse.json(created);
    },
);
