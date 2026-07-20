import { describe, expect, it } from "vitest";
import type { Todo } from "@/db/schema";
import type { HabitWithProgress } from "@/server/services/habit.service";
import { selectTodayTodos, splitHabits } from "@/lib/today";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const TODAY = "2026-07-20";
/** Local midnight — the string has no `Z`, so it parses in local time. */
const TODAY_START = new Date("2026-07-20T00:00:00").getTime();

function todo(over: Partial<Todo> = {}): Todo {
  return {
    id: "t1",
    userId: "u1",
    title: "Task",
    notes: null,
    categoryId: null,
    isDone: 0,
    sortOrder: 0,
    dueDate: null,
    priority: 0,
    createdAt: 0,
    completedAt: null,
    ...over,
  };
}

function habit(over: Partial<HabitWithProgress> = {}): HabitWithProgress {
  return {
    id: "h1",
    userId: "u1",
    name: "Water",
    targetCount: 8,
    unit: null,
    color: null,
    sortOrder: 0,
    isArchived: 0,
    createdAt: 0,
    todayCount: 0,
    streak: 0,
    ...over,
  };
}

function ids(list: { id: string }[]): string[] {
  return list.map((t) => t.id);
}

describe("selectTodayTodos", () => {
  it("returns empty groups for empty input", () => {
    const result = selectTodayTodos([], TODAY_START, TODAY);
    expect(result).toEqual({ overdue: [], dueToday: [], nextUp: [] });
  });

  it("excludes completed todos from every group", () => {
    const result = selectTodayTodos(
      [
        todo({ id: "done-overdue", isDone: 1, dueDate: TODAY_START - DAY }),
        todo({ id: "done-today", isDone: 1, dueDate: TODAY_START }),
        todo({ id: "done-undated", isDone: 1 }),
      ],
      TODAY_START,
      TODAY,
    );
    expect(result).toEqual({ overdue: [], dueToday: [], nextUp: [] });
  });

  it("treats a todo due before local midnight as overdue", () => {
    const result = selectTodayTodos(
      [todo({ id: "a", dueDate: TODAY_START - 1 })],
      TODAY_START,
      TODAY,
    );
    expect(ids(result.overdue)).toEqual(["a"]);
    expect(result.dueToday).toEqual([]);
  });

  it("treats a todo due exactly at local midnight as due today, not overdue", () => {
    const result = selectTodayTodos(
      [todo({ id: "a", dueDate: TODAY_START })],
      TODAY_START,
      TODAY,
    );
    expect(result.overdue).toEqual([]);
    expect(ids(result.dueToday)).toEqual(["a"]);
  });

  it("treats a todo due late today as due today, not overdue", () => {
    const result = selectTodayTodos(
      [todo({ id: "a", dueDate: TODAY_START + 23 * HOUR })],
      TODAY_START,
      TODAY,
    );
    expect(result.overdue).toEqual([]);
    expect(ids(result.dueToday)).toEqual(["a"]);
  });

  it("puts a future-dated todo in no group", () => {
    const result = selectTodayTodos(
      [todo({ id: "a", dueDate: TODAY_START + DAY })],
      TODAY_START,
      TODAY,
    );
    expect(result).toEqual({ overdue: [], dueToday: [], nextUp: [] });
  });

  it("sorts overdue oldest first", () => {
    const result = selectTodayTodos(
      [
        todo({ id: "recent", dueDate: TODAY_START - DAY }),
        todo({ id: "ancient", dueDate: TODAY_START - 10 * DAY }),
        todo({ id: "middle", dueDate: TODAY_START - 3 * DAY }),
      ],
      TODAY_START,
      TODAY,
    );
    expect(ids(result.overdue)).toEqual(["ancient", "middle", "recent"]);
  });

  it("sorts nextUp by priority descending", () => {
    const result = selectTodayTodos(
      [
        todo({ id: "low", priority: 1 }),
        todo({ id: "high", priority: 3 }),
        todo({ id: "mid", priority: 2 }),
      ],
      TODAY_START,
      TODAY,
    );
    expect(ids(result.nextUp)).toEqual(["high", "mid", "low"]);
  });

  it("breaks nextUp priority ties with sortOrder", () => {
    const result = selectTodayTodos(
      [
        todo({ id: "third", priority: 2, sortOrder: 30 }),
        todo({ id: "first", priority: 2, sortOrder: 10 }),
        todo({ id: "second", priority: 2, sortOrder: 20 }),
      ],
      TODAY_START,
      TODAY,
    );
    expect(ids(result.nextUp)).toEqual(["first", "second", "third"]);
  });

  it("fills nextUp with only the slots left under the cap", () => {
    const dated = [
      todo({ id: "o1", dueDate: TODAY_START - DAY }),
      todo({ id: "o2", dueDate: TODAY_START - DAY }),
      todo({ id: "d1", dueDate: TODAY_START }),
    ];
    const undated = [
      todo({ id: "u1", sortOrder: 1 }),
      todo({ id: "u2", sortOrder: 2 }),
      todo({ id: "u3", sortOrder: 3 }),
      todo({ id: "u4", sortOrder: 4 }),
    ];
    const result = selectTodayTodos([...dated, ...undated], TODAY_START, TODAY, 5);
    // 2 overdue + 1 due today = 3 of 5 used, so 2 slots remain.
    expect(ids(result.nextUp)).toEqual(["u1", "u2"]);
  });

  it("leaves nextUp empty when dated todos already fill the cap", () => {
    const dated = Array.from({ length: 5 }, (_, i) =>
      todo({ id: `d${i}`, dueDate: TODAY_START }),
    );
    const result = selectTodayTodos(
      [...dated, todo({ id: "u1" })],
      TODAY_START,
      TODAY,
      5,
    );
    expect(result.nextUp).toEqual([]);
  });

  it("never truncates overdue or dueToday, even past the cap", () => {
    const overdue = Array.from({ length: 7 }, (_, i) =>
      todo({ id: `o${i}`, dueDate: TODAY_START - (i + 1) * DAY }),
    );
    const dueToday = Array.from({ length: 3 }, (_, i) =>
      todo({ id: `d${i}`, dueDate: TODAY_START }),
    );
    const result = selectTodayTodos(
      [...overdue, ...dueToday, todo({ id: "u1" })],
      TODAY_START,
      TODAY,
      5,
    );
    expect(result.overdue).toHaveLength(7);
    expect(result.dueToday).toHaveLength(3);
    expect(result.nextUp).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [
      todo({ id: "b", priority: 1 }),
      todo({ id: "a", priority: 3 }),
    ];
    selectTodayTodos(input, TODAY_START, TODAY);
    expect(ids(input)).toEqual(["b", "a"]);
  });
});

describe("splitHabits", () => {
  it("returns empty groups for empty input", () => {
    expect(splitHabits([])).toEqual({ incomplete: [], complete: [] });
  });

  it("counts a habit at exactly its target as complete", () => {
    const result = splitHabits([
      habit({ id: "at-target", targetCount: 8, todayCount: 8 }),
    ]);
    expect(ids(result.complete)).toEqual(["at-target"]);
    expect(result.incomplete).toEqual([]);
  });

  it("counts a habit one below its target as incomplete", () => {
    const result = splitHabits([
      habit({ id: "under", targetCount: 8, todayCount: 7 }),
    ]);
    expect(ids(result.incomplete)).toEqual(["under"]);
    expect(result.complete).toEqual([]);
  });

  it("counts a habit past its target as complete", () => {
    const result = splitHabits([
      habit({ id: "over", targetCount: 8, todayCount: 12 }),
    ]);
    expect(ids(result.complete)).toEqual(["over"]);
  });

  it("preserves input order within each group", () => {
    const result = splitHabits([
      habit({ id: "i1", todayCount: 0, targetCount: 3 }),
      habit({ id: "c1", todayCount: 3, targetCount: 3 }),
      habit({ id: "i2", todayCount: 1, targetCount: 3 }),
      habit({ id: "c2", todayCount: 5, targetCount: 3 }),
    ]);
    expect(ids(result.incomplete)).toEqual(["i1", "i2"]);
    expect(ids(result.complete)).toEqual(["c1", "c2"]);
  });
});
