import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth/api';
import type { StatusTask } from '@/types/status-task';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api';
import { batchUpdateStatusTask } from '@/lib/utils/task/queries';

async function handleBatchUpdateStatusTask(
  request: NextRequest,
  context: { user: AuthenticatedUser },
): Promise<NextResponse> {
  const { taskIds, status } = await request.json() as { taskIds: string[]; status: StatusTask };

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json(
      { error: 'taskIds array is required and must not be empty' },
      { status: 400 },
    );
  }

  if (!status) {
    return NextResponse.json(
      { error: 'Status is required' },
      { status: 400 },
    );
  }

  const updatedTasks = await batchUpdateStatusTask(taskIds, status, context.user.id);

  return NextResponse.json({
    updatedCount: updatedTasks.length,
    status,
    updatedTasks,
  });
}

/**
 * @swagger
 * /api/tasks/batch/status:
 *   patch:
 *     summary: Update the status of multiple tasks at once
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taskIds, status]
 *             properties:
 *               taskIds:
 *                 type: array
 *                 items: { type: string }
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Updated tasks
 *       400:
 *         description: Missing taskIds or status
 */
export const PATCH = withAuth(handleBatchUpdateStatusTask);
