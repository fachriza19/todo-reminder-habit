"use client";

import Link from "next/link";
import { ArrowLeft, Minus, Plus, Flame } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useHabit, useLogHabit } from "@/hooks/use-habits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { TruncatedText } from "@/components/common/truncated-text";
import { ProgressRing } from "./progress-ring";
import { HabitCalendar } from "./habit-calendar";

export function HabitDetail({ id }: { id: string }) {
  const habitQuery = useHabit(id);
  const log = useLogHabit();
  const habit = habitQuery.data;

  function setCount(count: number) {
    log.mutate(
      { habitId: id, count: Math.max(0, count) },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <div className="grid gap-5">
      <Link
        href="/habits"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Habits
      </Link>

      {habitQuery.isPending ? (
        <div className="grid gap-5">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : habitQuery.isError || !habit ? (
        <ErrorState
          title="Couldn't load this habit"
          message="It may have been deleted."
          onRetry={() => habitQuery.refetch()}
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
              <ProgressRing
                value={habit.todayCount}
                max={habit.targetCount}
                color={habit.color}
                size={120}
                strokeWidth={9}
              >
                <div className="grid">
                  <span className="text-2xl font-semibold tabular-nums">
                    {habit.todayCount}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    of {habit.targetCount}
                  </span>
                </div>
              </ProgressRing>

              <div>
                <h1 className="text-xl font-semibold">
                  <TruncatedText text={habit.name} />
                </h1>
                {habit.unit ? (
                  <TruncatedText
                    as="p"
                    text={habit.unit}
                    className="text-muted-foreground text-sm"
                  />
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full"
                  aria-label="Decrease"
                  disabled={habit.todayCount <= 0}
                  onClick={() => setCount(habit.todayCount - 1)}
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  key={habit.todayCount}
                  defaultValue={habit.todayCount}
                  onChange={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(
                      /[^0-9]/g,
                      "",
                    );
                  }}
                  onBlur={(e) => {
                    const p = Number.parseInt(e.currentTarget.value, 10);
                    if (Number.isNaN(p) || p < 0) {
                      e.currentTarget.value = String(habit.todayCount);
                    } else if (p !== habit.todayCount) {
                      setCount(p);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  inputMode="numeric"
                  aria-label="Count today"
                  className="h-11 w-16 text-center text-lg tabular-nums"
                />
                <Button
                  size="icon"
                  className={cn(
                    "size-11 rounded-full",
                    habit.todayCount >= habit.targetCount &&
                      "bg-success hover:bg-success/90",
                  )}
                  aria-label="Increase"
                  onClick={() => setCount(habit.todayCount + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <span className="text-muted-foreground text-sm">
                Current streak
              </span>
              <span className="text-warning inline-flex items-center gap-1.5 text-lg font-semibold">
                <Flame className="size-5" />
                {habit.streak} day{habit.streak === 1 ? "" : "s"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <HabitCalendar
                habitId={habit.id}
                targetCount={habit.targetCount}
                color={habit.color}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
