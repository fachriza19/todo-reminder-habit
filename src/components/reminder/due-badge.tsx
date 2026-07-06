"use client";

import { cn } from "@/lib/utils";
import { useReminders } from "@/hooks/use-reminders";
import { useNow } from "@/hooks/use-now";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { dueCount } from "@/lib/reminders";

/**
 * Live count of due reminders for the nav (F-REM-4). Renders nothing until
 * mounted so SSR + first client render match (no badge on the server).
 */
export function DueBadge({ className }: { className?: string }) {
  const { data } = useReminders();
  const now = useNow(60_000);
  const mounted = useIsMounted();

  const count = mounted ? dueCount(data ?? [], now) : 0;
  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} due`}
      className={cn(
        "bg-warning text-warning-foreground inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
        className,
      )}
    >
      {count}
    </span>
  );
}
