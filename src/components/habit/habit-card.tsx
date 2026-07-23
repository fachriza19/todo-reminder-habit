"use client";

import Link from "next/link";
import { Minus, Plus, Flame, MoreVertical, Pencil, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { HabitWithProgress } from "@/server/services/habit.service";
import { useLogHabit } from "@/hooks/use-habits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TruncatedText } from "@/components/common/truncated-text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProgressRing } from "./progress-ring";

export function HabitCard({
  habit,
  onEdit,
  onArchive,
  onDelete,
}: {
  habit: HabitWithProgress;
  onEdit: (habit: HabitWithProgress) => void;
  onArchive: (habit: HabitWithProgress) => void;
  onDelete: (habit: HabitWithProgress) => void;
}) {
  const log = useLogHabit();

  function setCount(count: number) {
    const clamped = Math.max(0, count);
    log.mutate(
      { habitId: habit.id, count: clamped },
      { onError: (e) => toast.error(e.message) },
    );
  }

  const complete = habit.todayCount >= habit.targetCount;

  return (
    <Card className="animate-in fade-in-0 flex flex-row items-center gap-3 p-3 duration-200 sm:gap-4 sm:p-4">
      <Link
        href={`/habits/${habit.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
        aria-label={`Open ${habit.name}`}
      >
        <ProgressRing
          value={habit.todayCount}
          max={habit.targetCount}
          color={habit.color}
        >
          <span className="text-sm font-semibold tabular-nums">
            {habit.todayCount}
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <TruncatedText as="p" text={habit.name} className="font-medium" />
          <p className="text-muted-foreground text-sm">
            {habit.todayCount}/{habit.targetCount}
            {habit.unit ? ` ${habit.unit}` : ""}
            {complete ? " · done" : ""}
          </p>
          {habit.streak > 0 ? (
            <span className="text-warning mt-0.5 inline-flex items-center gap-1 text-xs font-medium">
              <Flame className="size-3.5" />
              {habit.streak} day{habit.streak === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-10 rounded-full"
          aria-label={`Decrease ${habit.name}`}
          disabled={habit.todayCount <= 0}
          onClick={() => setCount(habit.todayCount - 1)}
        >
          <Minus className="size-4" />
        </Button>
        <Input
          key={habit.todayCount}
          defaultValue={habit.todayCount}
          onChange={(e) => {
            e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, "");
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
          aria-label={`${habit.name} count today`}
          className="h-10 w-12 px-0 text-center tabular-nums"
        />
        <Button
          size="icon"
          className={cn("size-10 rounded-full", complete && "bg-success hover:bg-success/90")}
          aria-label={`Increase ${habit.name}`}
          onClick={() => setCount(habit.todayCount + 1)}
        >
          <Plus className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`More options for ${habit.name}`}
              />
            }
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(habit)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(habit)}>
              <Archive className="size-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(habit)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
