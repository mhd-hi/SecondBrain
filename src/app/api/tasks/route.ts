import type { NewTaskInput, UpdateTaskInput } from '@/types/api/task';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { assertUserOwnsCourse, createUserTask, deleteUserTask, getUserCourseTasks, updateUserTask } from '@/lib/auth/db';
import { StatusTask } from '@/types/status-task';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthSimple(
  async (request, user) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const statusParam = searchParams.get('status');

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId parameter is required', code: 'MISSING_PARAMETER' },
        { status: 400 },
      );
    }

    await assertUserOwnsCourse(courseId, user.id);
    const courseTasks = await getUserCourseTasks(courseId, user.id);

    // Filter by status if provided
    let filteredTasks = courseTasks;
    if (statusParam) {
      const statusStrings = statusParam.split(',').map(s => s.trim());
      filteredTasks = courseTasks.filter(task => statusStrings.includes(task.status));
    }

    return NextResponse.json(filteredTasks, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  },
);

export const POST = withAuthSimple(
  async (request, user) => {
    const data = await request.json() as {
      courseId: string;
      tasks: NewTaskInput[];
    };

    const { courseId, tasks: newTasks } = data;

    await assertUserOwnsCourse(courseId, user.id);

    try {
      // Create tasks with secure function
      const tasksToCreate = newTasks.map((task) => {
        const userProvidedDueDate = task.dueDate ? new Date(task.dueDate) : null;

        // Validate that dueDate is provided and valid
        if (!userProvidedDueDate || Number.isNaN(userProvidedDueDate.getTime())) {
          throw new Error(`Task "${task.title}" must have a valid dueDate`);
        }

        return {
          ...task,
          courseId,
          status: task.status ?? StatusTask.TODO,
          subtasks: task.subtasks?.map(subtask => ({
            ...subtask,
            id: crypto.randomUUID(),
          })),
          dueDate: userProvidedDueDate,
        };
      });

      // Use secure bulk insert
      const createdTasks = [];
      for (const taskData of tasksToCreate) {
        const task = await createUserTask(user.id, taskData, {
          skipCourseOwnershipCheck: true,
        });
        createdTasks.push(task);
      }

      return NextResponse.json(createdTasks);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid task data', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
  },
);

export const PATCH = withAuthSimple(
  async (request, user) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required', code: 'MISSING_PARAMETER' },
        { status: 400 },
      );
    }

    const updates = await request.json() as UpdateTaskInput;

    const payload = {
      ...updates,
      status: updates.status ?? StatusTask.TODO,
      subtasks: updates.subtasks?.map(subtask => ({
        ...subtask,
        id: subtask.id ?? crypto.randomUUID(),
      })),
      notes: updates.notes,
    } as Partial<typeof import('@/server/db/schema').tasks.$inferInsert> & { subtasks?: Partial<typeof import('@/server/db/schema').subtasks.$inferInsert>[] };

    const updatedTask = await updateUserTask(id, user.id, payload);

    return NextResponse.json(updatedTask);
  },
);

export const DELETE = withAuthSimple(
  async (request, user) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required', code: 'MISSING_PARAMETER' },
        { status: 400 },
      );
    }

    await deleteUserTask(id, user.id);
    return NextResponse.json({ success: true });
  },
);
