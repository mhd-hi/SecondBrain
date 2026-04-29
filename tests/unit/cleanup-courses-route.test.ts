import { beforeEach, describe, expect, it, vi } from 'vitest';

const cleanupOldCoursesMock = vi.fn();

vi.mock('@/env', () => ({
  env: {
    CRON_SECRET: 'test-cron-secret',
  },
}));

vi.mock('@/server/db/queries', () => ({
  cleanupOldCourses: (...args: unknown[]) => cleanupOldCoursesMock(...args),
}));

const { GET } = await import('@/app/api/cron/cleanup-courses/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cleanup courses cron route', () => {
  it('rejects requests without the expected bearer token', async () => {
    const response = await GET(new Request('http://localhost/api/cron/cleanup-courses'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Unauthorized',
      code: 'CRON_UNAUTHORIZED',
    });
    expect(cleanupOldCoursesMock).not.toHaveBeenCalled();
  });

  it('runs the cleanup when the bearer token matches the configured secret', async () => {
    cleanupOldCoursesMock.mockResolvedValue([{ id: 'course-1' }, { id: 'course-2' }]);

    const response = await GET(new Request('http://localhost/api/cron/cleanup-courses', {
      headers: {
        authorization: 'Bearer test-cron-secret',
      },
    }));

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(cleanupOldCoursesMock).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({
      success: true,
      message: 'Cleanup completed',
      deletedRecords: [{ id: 'course-1' }, { id: 'course-2' }],
    });
    expect(typeof body.timestamp).toBe('string');
  });
});
