import { Skeleton } from '@/components/ui/skeleton';

function DashboardSidebarSkeleton() {
  return (
    <aside className="hidden border-r bg-card/60 px-4 py-5 lg:flex lg:w-72 lg:flex-col">
      <Skeleton className="mb-6 h-8 w-36" />
      <Skeleton className="mb-4 h-4 w-20" />
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={`dashboard-sidebar-skeleton-${index}`} className="h-10 w-full" />
        ))}
      </div>
      <div className="mt-auto pt-6">
        <Skeleton className="h-12 w-full" />
      </div>
    </aside>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <DashboardSidebarSkeleton />
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="border-b bg-background/95 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-8 w-8 lg:hidden" />
            <div className="hidden gap-3 lg:flex">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
        </div>

        <main className="container mx-auto flex min-h-screen max-w-full flex-col gap-6 px-8 py-4">
          <Skeleton className="h-10 w-52" />
          <Skeleton className="h-32 w-full" />
          <div className="grid w-full gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={`dashboard-course-skeleton-${index}`} className="h-56 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    </div>
  );
}
