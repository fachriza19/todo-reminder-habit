import { TodoSkeleton } from "@/components/todo/todo-skeleton";

/** Instant loading state for client navigations (loading.js convention). */
export default function TodosLoading() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
      <TodoSkeleton />
    </div>
  );
}
