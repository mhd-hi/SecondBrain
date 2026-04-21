'use client';

import type { Session } from 'next-auth';
import type { Course } from '@/types/course';
import { SessionProvider } from 'next-auth/react';
import * as React from 'react';
import { useCourseStore } from '@/lib/stores/course-store';

type DashboardProvidersProps = {
  children: React.ReactNode;
  initialCourses: Course[];
  session: Session;
};

export function DashboardProviders({
  children,
  initialCourses,
  session,
}: DashboardProvidersProps) {
  React.useEffect(() => {
    useCourseStore.getState().bootstrapCourses(initialCourses);
  }, [initialCourses]);

  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}
