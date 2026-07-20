import { TodaySkeleton } from "@/components/today/today-skeleton";

/**
 * Instant loading state for client navigations (loading.js convention).
 * Mirrors TodayView's shell so the swap to real content doesn't jump.
 */
export default function TodayLoading() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      </header>
      <TodaySkeleton />
    </div>
  );
}
