import { Skeleton } from "@/components/ui/skeleton";

export function HabitSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border p-4"
        >
          <Skeleton className="size-14 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}
