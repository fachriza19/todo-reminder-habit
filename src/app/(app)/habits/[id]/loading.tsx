import { Skeleton } from "@/components/ui/skeleton";

/** Instant loading state for client navigations (loading.js convention). */
export default function HabitDetailLoading() {
  return (
    <div className="grid gap-6" aria-hidden>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
