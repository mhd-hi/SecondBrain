'use client';

import type { Course } from '@/types/course';
import * as React from 'react';
import { AIChatAssistant } from '@/components/AIChat/AIChatAssistant';
import CommandPalette from '@/components/CommandPalette/CommandPalette';
import Navbar from '@/components/shared/Navigation/Navbar/Navbar';
import { AppSidebar } from '@/components/shared/Navigation/Sidebar/sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useCourseOperations } from '@/hooks/course/use-course-store';
import { getCourseListItemsFromCourses } from '@/lib/stores/course-store';
import { TEST_IDS } from '@/lib/testing/selectors';

export default function DashboardLayoutContent({
  children,
  initialCourses,
}: {
  children: React.ReactNode;
  initialCourses: Course[];
}) {
  const { coursesListItems, isLoading, refreshCourses } = useCourseOperations();
  const initialCourseListItems = React.useMemo(
    () => getCourseListItemsFromCourses(initialCourses),
    [initialCourses],
  );

  const sidebarCourses =
    coursesListItems.length > 0 || initialCourses.length === 0
      ? coursesListItems
      : initialCourseListItems;
  const sidebarIsLoading = isLoading && initialCourses.length === 0;

  return (
    <SidebarProvider>
      <div
        className="flex h-svh w-full overflow-hidden"
        data-testid={TEST_IDS.shell.layout}
      >
        <AppSidebar
          courses={sidebarCourses}
          isLoading={sidebarIsLoading}
          onCourseAdded={refreshCourses}
        />
        <SidebarInset className="flex h-svh min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Navbar />
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <main className="container flex min-h-0 max-w-full flex-1 flex-col overflow-auto">
              {children}
            </main>
            <AIChatAssistant />
          </div>
        </SidebarInset>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
