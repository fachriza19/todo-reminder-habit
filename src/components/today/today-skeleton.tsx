import { Skeleton } from "@/components/ui/skeleton";

export function TodaySkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="grid gap-3">
          <Skeleton className="h-4 w-28" />
          <ul className="grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border px-3 py-3"
              >
                <Skeleton className="size-5 rounded-md" />
                <Skeleton
                  className="h-4 flex-1"
                  style={{ maxWidth: `${70 - i * 10}%` }}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
