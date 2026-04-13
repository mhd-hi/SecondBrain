/* eslint-disable ts/no-explicit-any */
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError, withAuth, withAuthSimple } from '@/lib/auth/api';
import { auth } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const request = new Request('http://localhost/api/test') as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('auth API wrappers', () => {
  it('returns 401 and does not call the handler when the session is missing', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const handlerSpy = vi.fn(async () => NextResponse.json({ ok: true }));
    const handler = withAuthSimple(handlerSpy);

    const res = await handler(request, { params: Promise.resolve({}) } as any);
    const body = await (res as Response).json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED', error: 'Authentication required' });
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('injects the authenticated user into withAuthSimple handlers', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      },
    } as any);

    const handler = withAuthSimple(async (_req, user) => NextResponse.json(user));
    const res = await handler(request, { params: Promise.resolve({}) } as any);
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
    });
  });

  it('passes route params through withAuth handlers', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any);

    const handler = withAuth<{ taskId: string }>(async (_req, { params, user }) => {
      const resolvedParams = await params;
      return NextResponse.json({ taskId: resolvedParams.taskId, userId: user.id });
    });

    const res = await handler(request, { params: Promise.resolve({ taskId: 'task-456' }) } as any);
    const body = await (res as Response).json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      taskId: 'task-456',
      userId: 'user-123',
    });
  });

  it('maps AuthorizationError to a 403 response', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any);

    const handler = withAuth(async () => {
      throw new AuthorizationError('Access denied to resource');
    });

    const res = await handler(request, { params: Promise.resolve({}) } as any);
    const body = await (res as Response).json();

    expect(res.status).toBe(403);
    expect(body).toEqual({
      code: 'UNAUTHORIZED',
      error: 'Access denied to resource',
    });
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when session lookup throws and records the failure', async () => {
    vi.mocked(auth).mockRejectedValue(new Error('connect ETIMEDOUT'));
    const handler = withAuthSimple(async () => NextResponse.json({ ok: true }));

    const res = await handler(request, { params: Promise.resolve({}) } as any);
    const body = await (res as Response).json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED', error: 'Authentication required' });
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled();
  });
});
