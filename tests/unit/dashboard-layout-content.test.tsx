/* eslint-disable ts/no-explicit-any */
import type { Mock } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLayoutContent from '@/app/(dashboard)/layout-content';
import { useCourseStore } from '@/lib/stores/course-store';
import { ensureHappyDom } from '../helpers/runtime';

const sessionProviderMock = vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>);
const appSidebarMock = vi.fn((_props?: unknown) => null);

vi.mock('next-auth/react', () => ({
  SessionProvider: (props: { children: React.ReactNode }) => sessionProviderMock(props),
  useSession: vi.fn(() => ({ status: 'authenticated' })),
}));
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

function renderComponent(ui: React.ReactElement) {
  const container = document.createElement('div');
  const root = createRoot(container);

  return {
    async render() {
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
  beforeEach(() => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useCourseStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    useCourseStore.getState().reset();
  });

  it('hydrates the dashboard subtree with the resolved session and bootstrapped course summaries', async () => {
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

    const view = renderComponent(
      <DashboardLayoutContent initialCourses={initialCourses as any} session={session as any}>
        <div>Dashboard body</div>
      </DashboardLayoutContent>,
    );

    try {
      await view.render();

      expect(sessionProviderMock).toHaveBeenCalledTimes(1);
      expect((sessionProviderMock as unknown as Mock).mock.calls[0]?.[0]).toMatchObject({ session });
      expect(useCourseStore.getState().fetchStatus).toBe('success');
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
