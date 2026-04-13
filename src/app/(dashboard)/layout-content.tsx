'use client';

import * as React from 'react';
import Navbar from '@/components/shared/Navigation/Navbar/Navbar';
import { AppSidebar } from '@/components/shared/Navigation/Sidebar/sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useCourseOperations } from '@/hooks/course/use-course-store';

export default function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { coursesListItems, isLoading, refreshCourses } = useCourseOperations();

  return (
    <SidebarProvider>
      <div className="flex w-full">
        <AppSidebar courses={coursesListItems} isLoading={isLoading} onCourseAdded={refreshCourses} />
        <SidebarInset className="flex flex-col flex-1">
          <Navbar />
          <main className="flex-1 container max-w-full">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
