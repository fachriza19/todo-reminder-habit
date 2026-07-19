"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Flame, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { HabitWithProgress } from "@/server/services/habit.service";
import { useLogHabit } from "@/hooks/use-habits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/habit/progress-ring";

export function TodayHabits({
  incomplete,
  complete,
}: {
  incomplete: HabitWithProgress[];
  complete: HabitWithProgress[];
}) {
  const log = useLogHabit();
  const [showComplete, setShowComplete] = useState(false);

  function increment(habit: HabitWithProgress) {
    log.mutate(
      { habitId: habit.id, count: habit.todayCount + 1 },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <div className="grid gap-2">
      {incomplete.map((habit) => (
        <Card
          key={habit.id}
          size="sm"
          className="animate-in fade-in-0 flex flex-row items-center gap-3 p-3 duration-200"
        >
          <Link
            href={`/habits/${habit.id}`}
            className="flex min-w-0 flex-1 items-center gap-3"
            aria-label={`Open ${habit.name}`}
          >
            <ProgressRing
              value={habit.todayCount}
              max={habit.targetCount}
              size={44}
              strokeWidth={4}
              color={habit.color}
            >
              <span className="text-xs font-semibold tabular-nums">
                {habit.todayCount}
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{habit.name}</p>
              <p className="text-muted-foreground text-xs">
                {habit.todayCount}/{habit.targetCount}
                {habit.unit ? ` ${habit.unit}` : ""}
              </p>
              {habit.streak > 0 ? (
                <span className="text-warning mt-0.5 inline-flex items-center gap-1 text-xs font-medium">
                  <Flame className="size-3" />
                  {habit.streak} day{habit.streak === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </Link>
          <Button
            size="icon"
            className="size-10 shrink-0 rounded-full"
            aria-label={`Increase ${habit.name}`}
            onClick={() => increment(habit)}
          >
            <Plus className="size-4" />
          </Button>
        </Card>
      ))}

      {complete.length > 0 ? (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setShowComplete((v) => !v)}
            aria-expanded={showComplete}
            className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-2 rounded-lg border border-dashed px-3 text-sm"
          >
            <Check className="text-success size-4" />
            {complete.length} done today
            <ChevronDown
              className={cn(
                "ml-auto size-4 transition-transform motion-reduce:transition-none",
                showComplete && "rotate-180",
              )}
            />
          </button>

          {showComplete ? (
            <ul className="grid gap-1.5">
              {complete.map((habit) => (
                <li
                  key={habit.id}
                  className="flex items-center gap-2 px-3 text-sm"
                >
                  <Check className="text-success size-3.5 shrink-0" />
                  <span className="truncate">{habit.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                    {habit.todayCount}/{habit.targetCount}
                  </span>
                  {habit.streak > 0 ? (
                    <span className="text-warning inline-flex shrink-0 items-center gap-1 text-xs font-medium">
                      <Flame className="size-3" />
                      {habit.streak}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
