"use client";

import { useMemo } from "react";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
  subWeeks,
} from "date-fns";

import { cn, getLocalToday } from "@/lib/utils";
import { useHabitHistory } from "@/hooks/use-habits";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";

const WEEKS = 17;

export function HabitCalendar({
  habitId,
  targetCount,
  color,
}: {
  habitId: string;
  targetCount: number;
  color?: string | null;
}) {
  const { today, from, to, days } = useMemo(() => {
    const todayStr = getLocalToday();
    const todayDate = new Date(`${todayStr}T00:00:00`);
    const start = startOfWeek(subWeeks(todayDate, WEEKS - 1), {
      weekStartsOn: 0,
    });
    const end = endOfWeek(todayDate, { weekStartsOn: 0 });
    return {
      today: todayStr,
      from: format(start, "yyyy-MM-dd"),
      to: format(end, "yyyy-MM-dd"),
      days: eachDayOfInterval({ start, end }).map((d) =>
        format(d, "yyyy-MM-dd"),
      ),
    };
  }, []);

  const history = useHabitHistory(habitId, from, to);

  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of history.data ?? []) map.set(log.date, log.count);
    return map;
  }, [history.data]);

  if (history.isPending) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (history.isError) {
    return (
      <ErrorState
        title="Couldn't load history"
        message="Try again in a moment."
        onRetry={() => history.refetch()}
      />
    );
  }

  return (
    <div className="no-scrollbar overflow-x-auto">
      <div
        className="grid grid-flow-col gap-1"
        style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
        role="img"
        aria-label="Habit completion over the last few months"
      >
        {days.map((date) => {
          const count = countByDate.get(date) ?? 0;
          const future = date > today;
          const complete = count >= targetCount && count > 0;
          const partial = count > 0 && !complete;
          return (
            <div
              key={date}
              title={`${date}: ${count}/${targetCount}`}
              className={cn(
                "size-3.5 rounded-[3px]",
                future && "opacity-30",
                !count && "bg-muted",
                partial && "opacity-60",
              )}
              style={
                count
                  ? {
                      backgroundColor: complete
                        ? "var(--success)"
                        : (color ?? "var(--primary)"),
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
      <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
        <span>Less</span>
        <span className="bg-muted size-3.5 rounded-[3px]" />
        <span
          className="size-3.5 rounded-[3px] opacity-60"
          style={{ backgroundColor: color ?? "var(--primary)" }}
        />
        <span
          className="size-3.5 rounded-[3px]"
          style={{ backgroundColor: "var(--success)" }}
        />
        <span>More</span>
      </div>
    </div>
  );
}
