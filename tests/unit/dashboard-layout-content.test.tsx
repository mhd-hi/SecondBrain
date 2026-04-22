import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComponent } from '../helpers/render-utils';
import { ensureHappyDom } from '../helpers/runtime';

const appSidebarMock = vi.fn((_props?: unknown) => null);
let mockCoursesListItems: Array<{
  id: string;
  code: string;
  name: string;
  color: string;
  overdueCount: number;
}> = [];
const refreshCoursesMock = vi.fn();

function resetMockCourseState() {
  mockCoursesListItems = [];
  refreshCoursesMock.mockReset();
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

vi.mock('@/components/shared/Navigation/Navbar/Navbar', () => ({
  default: () => null,
}));
vi.mock('@/components/CommandPalette/CommandPalette', () => ({
  default: () => null,
}));
vi.mock('@/components/shared/Navigation/Sidebar/sidebar', () => ({
  AppSidebar: (props: unknown) => appSidebarMock(props),
}));
vi.mock('@/components/ui/sidebar', () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/stores/course-store', () => ({
  getCourseListItemsFromCourses,
}));
vi.mock('@/hooks/course/use-course-store', () => ({
  useCourseOperations: () => ({
    coursesListItems: mockCoursesListItems,
    isLoading: false,
    refreshCourses: refreshCoursesMock,
  }),
}));

describe('DashboardLayoutContent', () => {
  beforeEach(() => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
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
          isLoading: false,
        }),
      );
    } finally {
      await view.unmount();
    }
  });
});
