import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusTask } from '@/types/status-task';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

const assertUserOwnsCourseMock = vi.fn();
const createUserTaskMock = vi.fn();
const deleteUserTaskMock = vi.fn();
const getUserCourseTasksMock = vi.fn();
const updateUserTaskMock = vi.fn();

vi.mock('@/lib/auth/db', () => ({
  assertUserOwnsCourse: (...args: unknown[]) => assertUserOwnsCourseMock(...args),
  createUserCourse: vi.fn(),
  createUserTask: (...args: unknown[]) => createUserTaskMock(...args),
  deleteUserCourse: vi.fn(),
  deleteUserTask: (...args: unknown[]) => deleteUserTaskMock(...args),
  getUserCourse: vi.fn(),
  getUserCourseSummaries: vi.fn(),
  getUserCourseTasks: (...args: unknown[]) => getUserCourseTasksMock(...args),
  getUserCourses: vi.fn(),
  getUserTask: vi.fn(),
  updateUserTask: (...args: unknown[]) => updateUserTaskMock(...args),
}));

describe('tasks route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertUserOwnsCourseMock.mockResolvedValue(undefined);
    createUserTaskMock.mockImplementation(async (_userId: string, payload: Record<string, unknown>) => payload);
    deleteUserTaskMock.mockResolvedValue(undefined);
    getUserCourseTasksMock.mockResolvedValue([]);
    updateUserTaskMock.mockImplementation(async (_taskId: string, _userId: string, payload: Record<string, unknown>) => payload);
  });

  it('returns no-store cache headers for course task lists', async () => {
    const { GET } = await import('@/app/api/tasks/route');
    const response = await GET(
      new Request('http://localhost/api/tasks?courseId=course-1') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate, max-age=0',
    );
    await expect(response.json()).resolves.toEqual([]);
    expect(assertUserOwnsCourseMock).toHaveBeenCalledWith('course-1', 'user-1');
    expect(getUserCourseTasksMock).toHaveBeenCalledWith('course-1', 'user-1');
  });

  it('returns 400 when the courseId parameter is missing', async () => {
    const { GET } = await import('@/app/api/tasks/route');
    const response = await GET(
      new Request('http://localhost/api/tasks') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'courseId parameter is required',
      code: 'MISSING_PARAMETER',
    });
    expect(assertUserOwnsCourseMock).not.toHaveBeenCalled();
  });

  it('filters course tasks by the requested status list', async () => {
    getUserCourseTasksMock.mockResolvedValue([
      { id: 'task-1', status: StatusTask.TODO },
      { id: 'task-2', status: StatusTask.IN_PROGRESS },
      { id: 'task-3', status: StatusTask.COMPLETED },
    ]);

    const { GET } = await import('@/app/api/tasks/route');
    const response = await GET(
      new Request('http://localhost/api/tasks?courseId=course-1&status=TODO,COMPLETED') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: 'task-1', status: StatusTask.TODO },
      { id: 'task-3', status: StatusTask.COMPLETED },
    ]);
  });

  it('returns 400 when creating a task without a valid due date', async () => {
    const { POST } = await import('@/app/api/tasks/route');
    const response = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'course-1',
          tasks: [
            {
              title: 'Invalid due date task',
              type: 'homework',
              estimatedEffort: 2,
              dueDate: 'not-a-date',
            },
          ],
        }),
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Task "Invalid due date task" must have a valid dueDate',
      code: 'VALIDATION_ERROR',
    });
    expect(createUserTaskMock).not.toHaveBeenCalled();
  });

  it('defaults task status to TODO and generates missing subtask ids on creation', async () => {
    const randomUuidSpy = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('generated-subtask-id');

    const { POST } = await import('@/app/api/tasks/route');
    const response = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'course-1',
          tasks: [
            {
              title: 'Create test task',
              notes: 'Notes',
              type: 'homework',
              estimatedEffort: 1.5,
              dueDate: '2026-05-04T12:00:00.000Z',
              subtasks: [
                { title: 'First subtask', notes: 'Draft it' },
              ],
            },
          ],
        }),
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    expect(createUserTaskMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        courseId: 'course-1',
        status: StatusTask.TODO,
        dueDate: new Date('2026-05-04T12:00:00.000Z'),
        subtasks: [
          expect.objectContaining({
            id: 'generated-subtask-id',
            title: 'First subtask',
            notes: 'Draft it',
          }),
        ],
      }),
      { skipCourseOwnershipCheck: true },
    );

    randomUuidSpy.mockRestore();
  });

  it('returns 400 when patching a task without an id query parameter', async () => {
    const { PATCH } = await import('@/app/api/tasks/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'id parameter is required',
      code: 'MISSING_PARAMETER',
    });
    expect(updateUserTaskMock).not.toHaveBeenCalled();
  });

  it('preserves an explicitly provided status when patching a task', async () => {
    const randomUuidSpy = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('patched-subtask-id');

    const { PATCH } = await import('@/app/api/tasks/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks?id=task-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: StatusTask.COMPLETED,
          subtasks: [{ title: 'New subtask' }],
        }),
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(200);
    expect(updateUserTaskMock).toHaveBeenCalledWith(
      'task-1',
      'user-1',
      expect.objectContaining({
        status: StatusTask.COMPLETED,
        subtasks: [
          expect.objectContaining({
            id: 'patched-subtask-id',
            title: 'New subtask',
          }),
        ],
      }),
    );

    randomUuidSpy.mockRestore();
  });

  it('returns 400 when deleting a task without an id query parameter', async () => {
    const { DELETE } = await import('@/app/api/tasks/route');
    const response = await DELETE(
      new Request('http://localhost/api/tasks', {
        method: 'DELETE',
      }) as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'id parameter is required',
      code: 'MISSING_PARAMETER',
    });
    expect(deleteUserTaskMock).not.toHaveBeenCalled();
  });
});
