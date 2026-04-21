import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth/api';
import type { Task } from '@/types/task';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api';
import { deleteUserTask, getUserTask, updateUserTask } from '@/lib/auth/db';
import { statusResponse } from '@/lib/utils/api/api-server-util';

async function handlePatchTask(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }>; user: AuthenticatedUser },
): Promise<NextResponse> {
  const { taskId } = await context.params;
  const updates = await request.json() as Partial<Task>;

  // Handle date fields properly
  const processedUpdates: Partial<Task> = { ...updates };

  if (updates.dueDate) {
    // Ensure dueDate is a proper Date object
    processedUpdates.dueDate = updates.dueDate instanceof Date
      ? updates.dueDate
      : new Date(updates.dueDate as string | number | Date);
  }

  // Process subtasks if they exist
  if (updates.subtasks) {
    processedUpdates.subtasks = updates.subtasks.map(subtask => ({
      ...subtask,
      id: subtask.id || crypto.randomUUID(),
    }));
  }

  // Use secure update function with automatic ownership verification
  const updatedTask = await updateUserTask(taskId, context.user.id, processedUpdates);

  return statusResponse(updatedTask);
}

async function handleDeleteTask(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }>; user: AuthenticatedUser },
): Promise<NextResponse> {
  const { taskId } = await context.params;

  // Use secure delete function with automatic ownership verification
  await deleteUserTask(taskId, context.user.id);

  return statusResponse({ success: true });
}

// Export the wrapped handlers
export const PATCH = withAuth(handlePatchTask);
export const DELETE = withAuth(handleDeleteTask);
export const GET = withAuth<{ taskId: string }>(
  async (request, { params, user }) => {
    const { taskId } = await params;

    const task = await getUserTask(taskId, user.id);

    return NextResponse.json(task);
  },
);
