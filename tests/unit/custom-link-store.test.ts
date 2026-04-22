import type { CustomLinkItem } from '@/types/custom-link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomLinkStore } from '@/lib/stores/custom-link-store';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
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

const originalFetch = globalThis.fetch;

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

describe('useCustomLinkStore.fetchCustomLinksByCourse', () => {
  beforeEach(() => {
    useCustomLinkStore.getState().reset();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    setFetchMock(originalFetch);
    vi.restoreAllMocks();
    useCustomLinkStore.getState().reset();
  });

  it('replaces only the fetched course links and tracks status per course', async () => {
    const existingCourseOneLink = createCustomLink({ id: 'course-1-link', courseId: 'course-1' });
    const staleCourseTwoLink = createCustomLink({ id: 'stale-course-2-link', courseId: 'course-2' });
    const freshCourseTwoLink = createCustomLink({ id: 'fresh-course-2-link', courseId: 'course-2' });

    useCustomLinkStore.getState().setCustomLinks([existingCourseOneLink, staleCourseTwoLink]);
    setFetchMock(vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        customLinks: [freshCourseTwoLink],
      }),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      useCustomLinkStore.getState().fetchCustomLinksByCourse('course-2'),
    ).resolves.toEqual([freshCourseTwoLink]);

    expect(useCustomLinkStore.getState().getCustomLinksByCourse('course-1')).toEqual([existingCourseOneLink]);
    expect(useCustomLinkStore.getState().getCustomLinksByCourse('course-2')).toEqual([freshCourseTwoLink]);
    expect(useCustomLinkStore.getState().getFetchStatusByCourse('course-2')).toBe('success');
    expect(useCustomLinkStore.getState().getFetchStatusByCourse('course-1')).toBe('idle');
  });
});
