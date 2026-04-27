import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthResult = { user?: { id: string; email?: string; name?: string } } | null;

const authMock = vi.fn<() => Promise<AuthResult>>();
const captureExceptionMock = vi.fn<(...args: unknown[]) => void>();

vi.mock('@/server/auth', () => ({ auth: authMock }));
vi.mock('@sentry/nextjs', () => ({ captureException: captureExceptionMock }));

const { AuthorizationError, withAuth, withAuthSimple } = await import('../../src/lib/auth/api');

const request = new Request('http://localhost/api/mock') as unknown as NextRequest;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('auth API wrappers', () => {
  it('returns 401 and does not call the handler when the session is missing', async () => {
    authMock.mockResolvedValue(null);
    const handlerSpy = vi.fn(async () => NextResponse.json({ ok: true }));
    const handler = withAuthSimple(handlerSpy);

    const res = await handler(request, { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> });
    const body = await (res as Response).json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED', error: 'Authentication required' });
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('injects the authenticated user into withAuthSimple handlers', async () => {
    authMock.mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      },
    });

    const handler = withAuthSimple(async (_req, user) => NextResponse.json(user));
    const res = await handler(request, { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> });
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
    });
  });

  it('passes route params through withAuth handlers', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-123' } });

    const handler = withAuth<{ taskId: string }>(async (_req, { params, user }) => {
      const resolvedParams = await params;
      return NextResponse.json({ taskId: resolvedParams.taskId, userId: user.id });
    });

    const res = await handler(request, { params: Promise.resolve({ taskId: 'task-456' }) });
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      taskId: 'task-456',
      userId: 'user-123',
    });
  });

  it('maps AuthorizationError to a 403 response', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-123' } });

    const handler = withAuth(async () => {
      throw new AuthorizationError('Access denied to resource');
    });

    const res = await handler(request, { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> });
    const body = await (res as Response).json();

    expect(res.status).toBe(403);
    expect(body).toEqual({
      code: 'UNAUTHORIZED',
      error: 'Access denied to resource',
    });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when session lookup throws and records the failure', async () => {
    authMock.mockRejectedValue(new Error('connect ETIMEDOUT'));
    const handler = withAuthSimple(async () => NextResponse.json({ ok: true }));

    const res = await handler(request, { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> });
    const body = await (res as Response).json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED', error: 'Authentication required' });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});
