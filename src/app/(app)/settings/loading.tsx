import { Skeleton } from "@/components/ui/skeleton";

/** Instant loading state for client navigations (loading.js convention). */
export default function SettingsLoading() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="grid gap-3" aria-hidden>
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}
