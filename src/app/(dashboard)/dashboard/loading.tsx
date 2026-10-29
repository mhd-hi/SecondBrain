import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-full flex-col gap-6 px-8 py-4">
      <Skeleton className="h-10 w-52" />
      <Skeleton className="h-32 w-full" />
      <div className="grid w-full gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={`dashboard-course-skeleton-${index}`} className="h-56 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </main>
  );
}
