import type { Todo } from "@/db/schema";
import { getLocalToday } from "@/lib/utils";
import type { HabitWithProgress } from "@/server/services/habit.service";

/**
 * How many todos the Today view shows at once. Only `nextUp` is truncated by
 * this — see `selectTodayTodos`.
 */
export const TODAY_TODO_CAP = 5;

/** A todo known to carry a due date, so consumers need no non-null assertion. */
export type DatedTodo = Todo & { dueDate: number };

export type TodayTodoGroups = {
  overdue: DatedTodo[];
  dueToday: DatedTodo[];
  nextUp: Todo[];
};

export type SplitHabits = {
  incomplete: HabitWithProgress[];
  complete: HabitWithProgress[];
};

/** Local calendar date of an epoch timestamp, via the canonical "today" source. */
function localDate(ms: number): string {
  return getLocalToday(new Date(ms));
}

/** Highest priority first, then the user's manual order, then oldest first. */
function byPriorityThenOrder(a: Todo, b: Todo): number {
  return (
    b.priority - a.priority ||
    a.sortOrder - b.sortOrder ||
    a.createdAt - b.createdAt
  );
}

function hasDueDate(todo: Todo): todo is DatedTodo {
  return todo.dueDate !== null;
}

/**
 * Pick the todos worth showing on Today.
 *
 * `todos.due_date` is nullable and the todo form exposes no date picker yet
 * (PRD T-TODO-1), so a strict due-date filter would leave this section empty
 * for most users. `nextUp` backfills with the highest-priority undated todos so
 * the section stays useful either way.
 *
 * `overdue` compares against `todayStart` — the start of the local day — rather
 * than the current time. Comparing against `now` would flip every todo due
 * today into "overdue" one minute past midnight, since a due date is a
 * date-level concept.
 *
 * `overdue` and `dueToday` are never truncated: they are genuinely due, and
 * hiding them to fit a display limit would be a correctness bug. Only `nextUp`
 * is capped, filling the slots those two leave free.
 */
export function selectTodayTodos(
  todos: Todo[],
  todayStart: number,
  today: string,
  cap: number = TODAY_TODO_CAP,
): TodayTodoGroups {
  const open = todos.filter((t) => t.isDone === 0);

  const overdue = open
    .filter(hasDueDate)
    .filter((t) => t.dueDate < todayStart)
    .sort((a, b) => a.dueDate - b.dueDate || byPriorityThenOrder(a, b));

  const dueToday = open
    .filter(hasDueDate)
    .filter((t) => t.dueDate >= todayStart && localDate(t.dueDate) === today)
    .sort(byPriorityThenOrder);

  const room = Math.max(0, cap - overdue.length - dueToday.length);
  const nextUp = open
    .filter((t) => t.dueDate === null)
    .sort(byPriorityThenOrder)
    .slice(0, room);

  return { overdue, dueToday, nextUp };
}

/**
 * Split active habits into the ones still needing work today and the ones
 * already at target. Input order is preserved within each group — the server
 * already sorts by sortOrder, then createdAt.
 */
export function splitHabits(habits: HabitWithProgress[]): SplitHabits {
  const incomplete: HabitWithProgress[] = [];
  const complete: HabitWithProgress[] = [];

  for (const habit of habits) {
    if (habit.todayCount >= habit.targetCount) complete.push(habit);
    else incomplete.push(habit);
  }

  return { incomplete, complete };
}
