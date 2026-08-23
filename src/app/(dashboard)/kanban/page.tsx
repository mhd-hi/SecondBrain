import { KanbanBoard } from '@/components/Kanban/KanbanBoard';

export default function KanbanPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-2 pb-4">
      <div className="flex w-full flex-col gap-1 px-4">
        <h1 className="text-foreground text-3xl font-bold">📋 Kanban Board</h1>
        <p className="text-muted-foreground">
          Drag tasks between columns to update their status.
        </p>
      </div>
      <section className="min-h-0 w-full flex-1 overflow-hidden">
        <KanbanBoard />
      </section>
    </main>
  );
}
