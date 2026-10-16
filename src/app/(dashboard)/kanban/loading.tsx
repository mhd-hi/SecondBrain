export default function KanbanLoading() {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-2 pb-4">
      <div className="flex w-full flex-col gap-1 px-4">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-2">
        {['todo', 'in-progress', 'completed'].map(status => (
          <div key={status} className="h-full min-w-72 flex-1 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    </main>
  );
}
