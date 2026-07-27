import { Skeleton } from '@/components/ui/skeleton';

export default function PomodoroLoading() {
  return (
    <main className="container mx-auto mt-2 flex flex-col gap-6 px-4 pb-16 sm:px-6 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">
        <div className="space-y-4">
          <div className="space-y-6 rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm sm:p-6">
            <div className="flex justify-center">
              <Skeleton className="h-10 w-full max-w-md rounded-xl" />
            </div>

            <div className="space-y-4 text-center">
              <div className="mx-auto space-y-2">
                <Skeleton className="mx-auto h-3 w-28" />
                <Skeleton className="mx-auto h-4 w-48" />
              </div>
              <Skeleton className="mx-auto h-16 w-56" />
              <div className="mx-auto max-w-xl px-2 sm:px-6">
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>

            <div className="border-t border-border/60 pt-5">
              <div className="flex items-center justify-center gap-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={`pomodoro-control-skeleton-${i}`} className="h-16 w-16 rounded-full" />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-border/70 p-5 shadow-sm sm:p-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/70 p-5 shadow-sm sm:p-6">
          <div className="space-y-1">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </section>
    </main>
  );
}
