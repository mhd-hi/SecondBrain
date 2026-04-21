/* eslint-disable ts/no-explicit-any */
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/lib/auth/api';
import { auth } from '@/server/auth';
import { getUserCourse } from '@/lib/auth/db';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/db', () => ({
  db: {
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));
vi.mock('@/server/db/schema', () => ({
  customLinks: {
    id: Symbol('customLinks.id'),
    courseId: Symbol('customLinks.courseId'),
    userId: Symbol('customLinks.userId'),
  },
}));
vi.mock('@/lib/auth/db', () => ({
  getUserCourse: vi.fn(),
}));

describe('custom links route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when creating a course-scoped link for a course the user does not own', async () => {
    (auth as unknown as Mock).mockResolvedValue({ user: { id: 'user-1' } } as any);
    (getUserCourse as unknown as Mock).mockRejectedValue(new AuthorizationError('Course not found'));

    const { POST } = await import('@/app/api/custom-links/route');
    const response = await POST(
      new Request('http://localhost/api/custom-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Portal',
          url: 'example.com',
          courseId: 'foreign-course',
        }),
      }) as never,
      { params: Promise.resolve({}) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: 'UNAUTHORIZED',
      error: 'Course not found',
    });
  });
});
