import { ReminderSkeleton } from "@/components/reminder/reminder-skeleton";

/** Instant loading state for client navigations (loading.js convention). */
export default function RemindersLoading() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
      <ReminderSkeleton />
    </div>
  );
}
