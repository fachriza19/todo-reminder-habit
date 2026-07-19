"use client";

import { useMemo } from "react";
import { format, startOfDay } from "date-fns";

import { getLocalToday } from "@/lib/utils";
import { groupReminders } from "@/lib/reminders";
import { selectTodayTodos, splitHabits } from "@/lib/today";
import { useTodos } from "@/hooks/use-todos";
import { useReminders } from "@/hooks/use-reminders";
import { useHabits } from "@/hooks/use-habits";
import { useNow } from "@/hooks/use-now";
import { ErrorState } from "@/components/common/error-state";
import { TodaySection } from "./today-section";
import { TodayTodos } from "./today-todos";
import { TodayReminders } from "./today-reminders";
import { TodayHabits } from "./today-habits";
import { TodayEmpty } from "./today-empty";
import { TodaySkeleton } from "./today-skeleton";

export function TodayView() {
  const todosQuery = useTodos();
  const remindersQuery = useReminders();
  const habitsQuery = useHabits();
  const now = useNow();

  const today = useMemo(
    () => (now === 0 ? "" : getLocalToday(new Date(now))),
    [now],
  );
  const todayStart = useMemo(
    () => (now === 0 ? 0 : startOfDay(new Date(now)).getTime()),
    [now],
  );

  const todoGroups = useMemo(
    () => selectTodayTodos(todosQuery.data ?? [], todayStart, today),
    [todosQuery.data, todayStart, today],
  );
  const reminderGroups = useMemo(
    () => groupReminders(remindersQuery.data ?? [], now, today),
    [remindersQuery.data, now, today],
  );
  const habitGroups = useMemo(
    () => splitHabits(habitsQuery.data ?? []),
    [habitsQuery.data],
  );

  // useNow() reports 0 until its mount effect runs, so `now === 0` is a
  // reliable "not hydrated yet" signal. Rendering before then would classify
  // every reminder against a 1970 epoch.
  const notReady =
    now === 0 ||
    todosQuery.isPending ||
    remindersQuery.isPending ||
    habitsQuery.isPending;

  const todoCount =
    todoGroups.overdue.length +
    todoGroups.dueToday.length +
    todoGroups.nextUp.length;
  const reminderCount =
    reminderGroups.overdue.length + reminderGroups.today.length;
  const habitCount = habitGroups.incomplete.length + habitGroups.complete.length;

  // "All clear" means nothing is asking for action. Completed habits still
  // render below it as the collapsed summary — finishing your habits should
  // read as an accomplishment, not as an empty screen.
  const allClear =
    !todosQuery.isError &&
    !remindersQuery.isError &&
    !habitsQuery.isError &&
    todoCount === 0 &&
    reminderCount === 0 &&
    habitGroups.incomplete.length === 0;

  return (
    <div className="grid gap-6">
      <header className="grid gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        {now > 0 ? (
          <p className="text-muted-foreground text-sm">
            {format(new Date(now), "EEEE, MMMM d")}
          </p>
        ) : null}
      </header>

      {notReady ? (
        <TodaySkeleton />
      ) : (
        <>
          {allClear ? <TodayEmpty /> : null}

          {remindersQuery.isError ? (
            <ErrorState
              title="Couldn't load your reminders"
              message="Check your connection and try again."
              onRetry={() => remindersQuery.refetch()}
            />
          ) : reminderCount > 0 ? (
            <TodaySection
              title="Reminders"
              count={reminderCount}
              href="/reminders"
              linkLabel="All reminders"
            >
              <TodayReminders
                overdue={reminderGroups.overdue}
                today={reminderGroups.today}
              />
            </TodaySection>
          ) : null}

          {todosQuery.isError ? (
            <ErrorState
              title="Couldn't load your tasks"
              message="Check your connection and try again."
              onRetry={() => todosQuery.refetch()}
            />
          ) : todoCount > 0 ? (
            <TodaySection
              title="Tasks"
              count={todoCount}
              href="/todos"
              linkLabel="All todos"
            >
              <TodayTodos groups={todoGroups} />
            </TodaySection>
          ) : null}

          {habitsQuery.isError ? (
            <ErrorState
              title="Couldn't load your habits"
              message="Check your connection and try again."
              onRetry={() => habitsQuery.refetch()}
            />
          ) : habitCount > 0 ? (
            <TodaySection
              title="Habits"
              count={habitGroups.incomplete.length}
              href="/habits"
              linkLabel="All habits"
            >
              <TodayHabits
                incomplete={habitGroups.incomplete}
                complete={habitGroups.complete}
              />
            </TodaySection>
          ) : null}
        </>
      )}
    </div>
  );
}
