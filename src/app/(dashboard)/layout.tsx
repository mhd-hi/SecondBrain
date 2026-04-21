import { redirect } from 'next/navigation';
import * as React from 'react';
import { getUserCourseSummaries } from '@/lib/auth/db';
import { ROUTES } from '@/lib/page-routes';
import { auth } from '@/server/auth';
import { DashboardProviders } from './dashboard-providers';
import DashboardLayoutContent from './layout-content';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(ROUTES.SIGNIN);
  }

  const initialCourses = await getUserCourseSummaries(session.user.id);

  return (
    <DashboardProviders initialCourses={initialCourses} session={session}>
      <DashboardLayoutContent initialCourses={initialCourses}>
        {children}
      </DashboardLayoutContent>
    </DashboardProviders>
  );
}
