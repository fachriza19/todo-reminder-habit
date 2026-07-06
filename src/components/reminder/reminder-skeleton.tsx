import { Skeleton } from "@/components/ui/skeleton";

export function ReminderSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="grid gap-2">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border px-3 py-3"
            >
              <Skeleton className="size-5 rounded-md" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
