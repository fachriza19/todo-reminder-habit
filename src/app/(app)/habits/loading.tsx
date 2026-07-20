import { HabitSkeleton } from "@/components/habit/habit-skeleton";

/** Instant loading state for client navigations (loading.js convention). */
export default function HabitsLoading() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
      <HabitSkeleton />
    </div>
  );
}
