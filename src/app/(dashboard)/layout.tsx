import { redirect } from 'next/navigation';
import * as React from 'react';
import { ROUTES } from '@/lib/page-routes';
import { auth } from '@/server/auth';
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

  return (
    <DashboardLayoutContent>
      {children}
    </DashboardLayoutContent>
  );
}
