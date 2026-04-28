import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockAuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

const deleteUserTaskMock = vi.fn();
const getUserTaskMock = vi.fn();
const updateUserTaskMock = vi.fn();

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: MockAuthorizationError,
  withAuth: vi.fn((handler: (req: Request, context: unknown) => Promise<Response>) =>
    async (req: Request, context: unknown) => {
      try {
        return await handler(req, context);
      } catch (error) {
        if (error instanceof Error && error.name === 'AuthorizationError') {
          return Response.json(
            { code: 'UNAUTHORIZED', error: error.message },
            { status: 403 },
          );
        }
        throw error;
      }
    }),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));
vi.mock('@/lib/auth/db', () => ({
  deleteUserTask: (...args: unknown[]) => deleteUserTaskMock(...args),
  getUserTask: (...args: unknown[]) => getUserTaskMock(...args),
  updateUserTask: (...args: unknown[]) => updateUserTaskMock(...args),
}));
vi.mock('@/lib/utils/api/api-server-util', () => ({
  statusResponse: (body: unknown) => Response.json(body),
}));

describe('task detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteUserTaskMock.mockResolvedValue(undefined);
    getUserTaskMock.mockResolvedValue({ id: 'task-1', title: 'Stored task' });
    updateUserTaskMock.mockImplementation(async (_taskId: string, _userId: string, payload: Record<string, unknown>) => payload);
  });

  it('returns the requested task for the authenticated user', async () => {
    const { GET } = await import('@/app/api/tasks/[taskId]/route');
    const response = await GET(
      new Request('http://localhost/api/tasks/task-1') as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'task-1', title: 'Stored task' });
    expect(getUserTaskMock).toHaveBeenCalledWith('task-1', 'user-1');
  });

  it('converts string due dates and generates missing subtask ids during patch', async () => {
    const randomUuidSpy = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('detail-subtask-id');

    const { PATCH } = await import('@/app/api/tasks/[taskId]/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks/task-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: '2026-05-20T12:00:00.000Z',
          subtasks: [{ title: 'Generated id subtask' }],
        }),
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(200);
    expect(updateUserTaskMock).toHaveBeenCalledWith(
      'task-1',
      'user-1',
      expect.objectContaining({
        dueDate: new Date('2026-05-20T12:00:00.000Z'),
        subtasks: [
          expect.objectContaining({
            id: 'detail-subtask-id',
            title: 'Generated id subtask',
          }),
        ],
      }),
    );

    randomUuidSpy.mockRestore();
  });

  it('deletes the requested task for the authenticated user', async () => {
    const { DELETE } = await import('@/app/api/tasks/[taskId]/route');
    const response = await DELETE(
      new Request('http://localhost/api/tasks/task-1', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(deleteUserTaskMock).toHaveBeenCalledWith('task-1', 'user-1');
  });

  it('returns 403 when reading a task the user does not own', async () => {
    getUserTaskMock.mockRejectedValue(new MockAuthorizationError('Task not found or access denied'));

    const { GET } = await import('@/app/api/tasks/[taskId]/route');
    const response = await GET(
      new Request('http://localhost/api/tasks/task-1') as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      error: 'Task not found or access denied',
    });
  });

  it('returns 403 when updating a task the user does not own', async () => {
    updateUserTaskMock.mockRejectedValue(new MockAuthorizationError('Task not found or access denied'));

    const { PATCH } = await import('@/app/api/tasks/[taskId]/route');
    const response = await PATCH(
      new Request('http://localhost/api/tasks/task-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Blocked update' }),
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      error: 'Task not found or access denied',
    });
  });

  it('returns 403 when deleting a task the user does not own', async () => {
    deleteUserTaskMock.mockRejectedValue(new MockAuthorizationError('Task not found or access denied'));

    const { DELETE } = await import('@/app/api/tasks/[taskId]/route');
    const response = await DELETE(
      new Request('http://localhost/api/tasks/task-1', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ taskId: 'task-1' }), user: { id: 'user-1' } } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      error: 'Task not found or access denied',
    });
  });
});
