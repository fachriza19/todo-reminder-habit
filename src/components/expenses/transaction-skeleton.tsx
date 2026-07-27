import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the day-grouped layout so the swap to real content doesn't jump. */
export function TransactionSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full rounded-lg" />
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 py-2">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-3.5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
