import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  withAuth: vi.fn((handler: unknown) => handler),
  withAuthSimple: vi.fn((handler: unknown) => handler),
}));

vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

describe('tasks calendar route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when start or end is missing', async () => {
    const { GET } = await import('@/app/api/tasks/calendar/route');
    const response = await GET(
      new Request('http://localhost/api/tasks/calendar?start=2026-05-01T00:00:00.000Z') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Start and end dates are required',
    });
  });

  it('returns 400 when dates are invalid', async () => {
    const { GET } = await import('@/app/api/tasks/calendar/route');
    const response = await GET(
      new Request('http://localhost/api/tasks/calendar?start=bad-date&end=2026-05-03T00:00:00.000Z') as never,
      { id: 'user-1' } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid date format',
    });
  });
});
