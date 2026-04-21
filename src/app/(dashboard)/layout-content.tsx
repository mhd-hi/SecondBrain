'use client';

import type { Session } from 'next-auth';
import type { Course } from '@/types/course';
import { SessionProvider } from 'next-auth/react';
import * as React from 'react';
import CommandPalette from '@/components/CommandPalette/CommandPalette';
import Navbar from '@/components/shared/Navigation/Navbar/Navbar';
import { AppSidebar } from '@/components/shared/Navigation/Sidebar/sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useCourseOperations } from '@/hooks/course/use-course-store';
import { getCourseListItemsFromCourses, useCourseStore } from '@/lib/stores/course-store';

export default function DashboardLayoutContent({
  children,
  initialCourses,
  session,
}: {
  children: React.ReactNode;
  initialCourses: Course[];
  session: Session;
}) {
  return (
    <SessionProvider session={session}>
      <DashboardShell initialCourses={initialCourses}>
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}

function DashboardShell({
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

  React.useEffect(() => {
    useCourseStore.getState().bootstrapCourses(initialCourses);
  }, [initialCourses]);

  const sidebarCourses = coursesListItems.length > 0 || initialCourses.length === 0
    ? coursesListItems
    : initialCourseListItems;
  const sidebarIsLoading = isLoading && initialCourses.length === 0;

  return (
    <SidebarProvider>
      <div className="flex w-full">
        <AppSidebar courses={sidebarCourses} isLoading={sidebarIsLoading} onCourseAdded={refreshCourses} />
        <SidebarInset className="flex flex-1 flex-col">
          <Navbar />
          <main className="container max-w-full flex-1">
            {children}
          </main>
        </SidebarInset>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
