import type { CustomLinkItem } from '@/types/custom-link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomLinkStore } from '@/lib/stores/custom-link-store';
import { api } from '@/lib/utils/api/api-client-util';

vi.mock('@/lib/utils/api/api-client-util', () => ({
  api: {
    get: vi.fn(),
  },
}));

function createCustomLink(overrides: Partial<CustomLinkItem> = {}): CustomLinkItem {
  return {
    id: 'link-1',
    url: 'https://example.com',
    title: 'Course Link',
    type: 'custom',
    courseId: 'course-1',
    userId: 'user-1',
    createdAt: '2026-04-07T09:00:00.000Z',
    updatedAt: '2026-04-07T09:00:00.000Z',
    ...overrides,
  };
}

describe('useCustomLinkStore.fetchCustomLinksByCourse', () => {
  beforeEach(() => {
    useCustomLinkStore.getState().reset();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useCustomLinkStore.getState().reset();
  });

  it('replaces only the fetched course links and tracks status per course', async () => {
    const existingCourseOneLink = createCustomLink({ id: 'course-1-link', courseId: 'course-1' });
    const staleCourseTwoLink = createCustomLink({ id: 'stale-course-2-link', courseId: 'course-2' });
    const freshCourseTwoLink = createCustomLink({ id: 'fresh-course-2-link', courseId: 'course-2' });

    useCustomLinkStore.getState().setCustomLinks([existingCourseOneLink, staleCourseTwoLink]);
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      customLinks: [freshCourseTwoLink],
    });

    await expect(
      useCustomLinkStore.getState().fetchCustomLinksByCourse('course-2'),
    ).resolves.toEqual([freshCourseTwoLink]);

    expect(useCustomLinkStore.getState().getCustomLinksByCourse('course-1')).toEqual([existingCourseOneLink]);
    expect(useCustomLinkStore.getState().getCustomLinksByCourse('course-2')).toEqual([freshCourseTwoLink]);
    expect(useCustomLinkStore.getState().getFetchStatusByCourse('course-2')).toBe('success');
    expect(useCustomLinkStore.getState().getFetchStatusByCourse('course-1')).toBe('idle');
  });
});
