import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureHappyDom } from '../helpers/runtime';

const sessionProviderMock = vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>);
const appSidebarMock = vi.fn((_props?: unknown) => null);
let mockFetchStatus: 'idle' | 'success' = 'idle';
let mockCoursesListItems: Array<{
  id: string;
  code: string;
  name: string;
  color: string;
  overdueCount: number;
}> = [];

function resetMockCourseState() {
  mockFetchStatus = 'idle';
  mockCoursesListItems = [];
}

function getCourseListItemsFromCourses(
  courses: Iterable<{
    id: string;
    code: string;
    name: string;
    color: string;
    overdueCount?: number;
  }>,
) {
  return Array.from(courses)
    .map(course => ({
      id: course.id,
      code: course.code,
      name: course.name,
      color: course.color,
      overdueCount: course.overdueCount ?? 0,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function renderComponent(ui: React.ReactElement) {
  const container = document.createElement('div');
  const root = createRoot(container);

  return {
    async render() {
      // We mount through ReactDOM directly in this helper, so manual act is required.
      // eslint-disable-next-line testing-library/no-unnecessary-act
      await act(async () => {
        root.render(ui);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

describe('DashboardLayoutContent', () => {
  beforeEach(async () => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('next-auth/react', () => ({
      SessionProvider: (props: { children: React.ReactNode }) => sessionProviderMock(props),
      useSession: vi.fn(() => ({ status: 'authenticated' })),
    }));
    vi.doMock('@/components/shared/Navigation/Navbar/Navbar', () => ({
      default: () => null,
    }));
    vi.doMock('@/components/CommandPalette/CommandPalette', () => ({
      default: () => null,
    }));
    vi.doMock('@/components/shared/Navigation/Sidebar/sidebar', () => ({
      AppSidebar: (props: unknown) => appSidebarMock(props),
    }));
    vi.doMock('@/components/ui/sidebar', () => ({
      SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }));
    vi.doMock('@/lib/stores/course-store', () => ({
      getCourseListItemsFromCourses,
      useCourseStore: {
        getState: () => ({
          bootstrapCourses: (courses: Parameters<typeof getCourseListItemsFromCourses>[0]) => {
            mockCoursesListItems = getCourseListItemsFromCourses(courses);
            mockFetchStatus = 'success';
          },
          reset: resetMockCourseState,
        }),
      },
    }));
    vi.doMock('@/hooks/course/use-course-store', () => ({
      // eslint-disable-next-line react/no-unnecessary-use-prefix
      useCourseOperations: () => ({
        coursesListItems: mockCoursesListItems,
        isLoading: false,
        refreshCourses: vi.fn(),
      }),
    }));
    resetMockCourseState();
  });

  afterEach(() => {
    resetMockCourseState();
  });

  it('hydrates the dashboard subtree with the resolved session and bootstrapped course summaries', async () => {
    const { default: DashboardLayoutContent } = await import('@/app/(dashboard)/layout-content');
    const initialCourses = [
      {
        id: 'course-1',
        code: 'LOG210',
        name: 'Software Construction',
        color: 'blue',
        daypart: 'AM',
        overdueCount: 2,
      },
    ];
    const session = { user: { id: 'user-1', name: 'Test User' } };
    const LayoutContent = DashboardLayoutContent as React.ComponentType<{
      children?: React.ReactNode;
      initialCourses: unknown[];
      session: unknown;
    }>;

    const view = renderComponent(
      React.createElement(
        LayoutContent,
        { initialCourses, session },
        <div>Dashboard body</div>,
      ),
    );

    try {
      await view.render();

      expect(mockFetchStatus).toBe('success');
      expect(appSidebarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          courses: [
            {
              id: 'course-1',
              code: 'LOG210',
              name: 'Software Construction',
              color: 'blue',
              overdueCount: 2,
            },
          ],
        }),
      );
    } finally {
      await view.unmount();
    }
  });
});
