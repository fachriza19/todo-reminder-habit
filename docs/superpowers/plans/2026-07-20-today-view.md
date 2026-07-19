# Today View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/today` route that merges due reminders, today's todos, and unlogged habits into one actionable screen.

**Architecture:** Client-side composition. A `TodayView` client component calls the three existing TanStack Query hooks (`useTodos`, `useReminders`, `useHabits`) and runs their data through pure selection functions in `src/lib/today.ts`. No new API routes and no new query keys — reusing `["todos"]`, `["reminders"]`, `["habits"]` means the existing mutation hooks already keep Today and the module pages in sync.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript strict, TanStack Query v5, Tailwind CSS v4, date-fns v4, Base UI / shadcn components, Vitest (added by Task 1).

**Spec:** `docs/superpowers/specs/2026-07-20-today-view-design.md`

## Global Constraints

- **Read the Next.js docs before writing route code.** Per `AGENTS.md`, this Next version has breaking changes from training data. Relevant: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` and `16-proxy.md`.
- Package manager is **pnpm 10.34.3**. Use `pnpm`, never `npm` or `yarn`.
- Dev server runs on **port 3100** (`pnpm dev`).
- Path alias `@/*` → `./src/*`.
- TypeScript is **strict**. No `any`. Avoid `!` non-null assertions where a type can express the guarantee instead.
- All timestamps are **epoch milliseconds**. `habit_logs.date` and `getLocalToday()` are `YYYY-MM-DD` local strings.
- `getLocalToday()` in `src/lib/utils.ts` is the single source of truth for "today" (PRD 5A.5). Never compute dates ad-hoc.
- Boolean columns are stored as integers: `isDone` / `isArchived` are `0 | 1`, not booleans. Validation input types use real booleans.
- UI copy is **English**, sentence case, no exclamation marks (PRD 5B.5).
- Interactive targets are **minimum 44px** (`min-h-11` / `size-10` / `size-11`) (PRD 5B.6).
- Every list screen needs loading, error, and empty states (PRD 5B.4).
- Commit after each task. Conventional Commits format.

---

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest config: node environment, `@` alias |
| `src/lib/today.ts` | Pure selection logic — no React, no I/O, no `Date.now()` |
| `src/lib/today.test.ts` | Unit tests for the above |
| `src/app/(app)/today/page.tsx` | Route: metadata + view |
| `src/components/today/today-section.tsx` | Shared section shell (title, count, "all →" link) |
| `src/components/today/today-skeleton.tsx` | Pending state |
| `src/components/today/today-empty.tsx` | All-clear panel |
| `src/components/today/today-todos.tsx` | Todo rows + toggle |
| `src/components/today/today-reminders.tsx` | Reminder rows + toggle |
| `src/components/today/today-habits.tsx` | Habit cards + collapsed completed summary |
| `src/components/today/today-view.tsx` | Orchestrator |

**Modified files**

| Path | Change |
|---|---|
| `package.json` | `vitest` devDependency, `test` + `test:watch` scripts |
| `src/proxy.ts` | `/today` in `APP_ROUTES` and `matcher`; two redirect targets |
| `src/app/page.tsx` | Redirect target |
| `src/components/auth/google-button.tsx` | `callbackURL` |
| `src/components/auth/login-form.tsx` | Post-login push target |
| `src/components/auth/signup-form.tsx` | Post-signup push target |
| `src/components/nav/app-nav.tsx` | `NAV_ITEMS` entry, tab bar grid `4` → `5` |

**Deviation from spec:** the spec named `Sun` as the Today nav icon. Use `CalendarDays` instead — `ThemeToggle` already owns Sun/Moon in this UI, and reusing Sun for navigation muddies that vocabulary.

---

## Task 1: Selection logic + Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/today.ts`
- Test: `src/lib/today.test.ts`
- Modify: `package.json` (devDependency + scripts)

**Interfaces:**
- Consumes: `Todo` from `@/db/schema`, `HabitWithProgress` from `@/server/services/habit.service`.
- Produces:
  - `TODAY_TODO_CAP: number` (= 5)
  - `type DatedTodo = Todo & { dueDate: number }`
  - `type TodayTodoGroups = { overdue: DatedTodo[]; dueToday: DatedTodo[]; nextUp: Todo[] }`
  - `selectTodayTodos(todos: Todo[], todayStart: number, today: string, cap?: number): TodayTodoGroups`
  - `type SplitHabits = { incomplete: HabitWithProgress[]; complete: HabitWithProgress[] }`
  - `splitHabits(habits: HabitWithProgress[]): SplitHabits`

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest@^3
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`. `import.meta.url` is used rather than `__dirname`, which is not defined when Vite loads an ESM TypeScript config.

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Pure functions only — no DOM environment needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Add the test scripts**

In `package.json`, add these two entries to `"scripts"`, immediately after `"typecheck"`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 4: Write the failing tests**

Create `src/lib/today.test.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "@/lib/today"` (the module does not exist yet).

- [ ] **Step 6: Implement the selection logic**

Create `src/lib/today.ts`:

```ts
import { format } from "date-fns";
import type { Todo } from "@/db/schema";
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

function localDate(ms: number): string {
  return format(new Date(ms), "yyyy-MM-dd");
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
```

Note: `.filter()` returns a new array, so the subsequent `.sort()` never mutates the caller's input — which the "does not mutate" test verifies.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 18 tests across 2 suites.

- [ ] **Step 8: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0 with no errors.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts src/lib/today.ts src/lib/today.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add Today view selection logic with Vitest

Pure functions for picking which todos and habits belong on the Today
view. Overdue compares against local midnight rather than now, so a
todo due today does not flip to overdue at 00:01. Only nextUp is
capped; genuinely-due items are never truncated.

Adds Vitest as the repo's first test harness.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Presentational shells

**Files:**
- Create: `src/components/today/today-section.tsx`
- Create: `src/components/today/today-skeleton.tsx`
- Create: `src/components/today/today-empty.tsx`

**Interfaces:**
- Consumes: `Skeleton` from `@/components/ui/skeleton`, `cn` from `@/lib/utils`.
- Produces:
  - `TodaySection({ title, count, href, linkLabel, children })` — `count?: number`, all others required; `children: React.ReactNode`
  - `TodaySkeleton()` — no props
  - `TodayEmpty()` — no props

These are server-safe presentational components: no `"use client"`, no hooks, no event handlers.

- [ ] **Step 1: Create the section shell**

Create `src/components/today/today-section.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Shared shell for a Today section: heading, optional count, and a link out to
 * the full module page.
 */
export function TodaySection({
  title,
  count,
  href,
  linkLabel,
  children,
}: {
  title: string;
  count?: number;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          {title}
          {count !== undefined && count > 0 ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal tabular-nums">
              {count}
            </span>
          ) : null}
        </h2>
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium"
        >
          {linkLabel}
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Create the skeleton**

Create `src/components/today/today-skeleton.tsx`:

```tsx
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
```

- [ ] **Step 3: Create the all-clear panel**

Create `src/components/today/today-empty.tsx`. The copy avoids claiming "every habit logged", since this also renders for a brand-new account with no data at all.

```tsx
import { Check } from "lucide-react";

export function TodayEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-success/10 text-success flex size-12 items-center justify-center rounded-full">
        <Check className="size-6" />
      </div>
      <div>
        <p className="font-medium">You&rsquo;re all set for today</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Nothing needs your attention right now.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0. Unused-export warnings are not expected — this repo's ESLint config does not flag them.

- [ ] **Step 5: Commit**

```bash
git add src/components/today/
git commit -m "feat: add Today view section shell, skeleton, and empty state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Content components

**Files:**
- Create: `src/components/today/today-todos.tsx`
- Create: `src/components/today/today-reminders.tsx`
- Create: `src/components/today/today-habits.tsx`

**Interfaces:**
- Consumes: `TodayTodoGroups` from `@/lib/today` (Task 1); `useUpdateTodo` from `@/hooks/use-todos`; `useUpdateReminder` from `@/hooks/use-reminders`; `useLogHabit` from `@/hooks/use-habits`; `ProgressRing` from `@/components/habit/progress-ring`; `Checkbox`, `Button`, `Card` from `@/components/ui/*`.
- Produces:
  - `TodayTodos({ groups }: { groups: TodayTodoGroups })`
  - `TodayReminders({ overdue, today }: { overdue: Reminder[]; today: Reminder[] })`
  - `TodayHabits({ incomplete, complete }: { incomplete: HabitWithProgress[]; complete: HabitWithProgress[] })`

All three are `"use client"` — they own mutations.

These deliberately do **not** reuse `TodoItem` or `ReminderItem`. `TodoItem` calls `useSortable`, which hard-requires a `DndContext` this page has no reason to mount, and both carry drag handles, edit/delete buttons, and category chips that do not belong on a summary screen.

- [ ] **Step 1: Create the todo rows**

Create `src/components/today/today-todos.tsx`:

```tsx
"use client";

import { format } from "date-fns";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Todo } from "@/db/schema";
import type { TodayTodoGroups } from "@/lib/today";
import { useUpdateTodo } from "@/hooks/use-todos";
import { Checkbox } from "@/components/ui/checkbox";

const PRIORITY_LABEL = ["None", "Low", "Medium", "High"];

function GroupLabel({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "overdue";
}) {
  return (
    <p
      className={cn(
        "text-xs font-medium",
        tone === "overdue" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function TodoRow({
  todo,
  meta,
  tone,
  onToggle,
}: {
  todo: Todo;
  meta?: string;
  tone?: "overdue";
  onToggle: (todo: Todo) => void;
}) {
  return (
    <li
      className={cn(
        "bg-card animate-in fade-in-0 flex items-center gap-3 rounded-lg border px-3 py-2.5 duration-200",
        tone === "overdue" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => onToggle(todo)}
        aria-label={`Mark “${todo.title}” as done`}
        className="size-6"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{todo.title}</span>
        {meta ? (
          <span
            className={cn(
              "text-xs",
              tone === "overdue"
                ? "text-destructive font-medium"
                : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        ) : null}
      </div>
      {todo.priority >= 2 ? (
        <Flag
          className={cn(
            "size-3.5 shrink-0",
            todo.priority === 3 ? "text-destructive" : "text-warning",
          )}
          aria-label={`${PRIORITY_LABEL[todo.priority]} priority`}
        />
      ) : null}
    </li>
  );
}

export function TodayTodos({ groups }: { groups: TodayTodoGroups }) {
  const update = useUpdateTodo();

  function toggle(todo: Todo) {
    update.mutate(
      { id: todo.id, patch: { isDone: true } },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <div className="grid gap-3">
      {groups.overdue.length > 0 ? (
        <div className="grid gap-2">
          <GroupLabel tone="overdue">Overdue</GroupLabel>
          <ul className="grid gap-2">
            {groups.overdue.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                tone="overdue"
                meta={`Due ${format(new Date(todo.dueDate), "MMM d")}`}
                onToggle={toggle}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {groups.dueToday.length > 0 ? (
        <div className="grid gap-2">
          <GroupLabel>Due today</GroupLabel>
          <ul className="grid gap-2">
            {groups.dueToday.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggle} />
            ))}
          </ul>
        </div>
      ) : null}

      {groups.nextUp.length > 0 ? (
        <div className="grid gap-2">
          <GroupLabel>Next up</GroupLabel>
          <ul className="grid gap-2">
            {groups.nextUp.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggle} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create the reminder rows**

Create `src/components/today/today-reminders.tsx`. The visual language matches `ReminderItem` — `border-warning/40 bg-warning/5` for due items.

```tsx
"use client";

import { format, isToday } from "date-fns";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Reminder } from "@/db/schema";
import { useUpdateReminder } from "@/hooks/use-reminders";
import { Checkbox } from "@/components/ui/checkbox";

function formatRemindAt(ms: number): string {
  const d = new Date(ms);
  return isToday(d) ? format(d, "h:mm a") : format(d, "MMM d, h:mm a");
}

function ReminderRow({
  reminder,
  due,
  onToggle,
}: {
  reminder: Reminder;
  due: boolean;
  onToggle: (reminder: Reminder) => void;
}) {
  return (
    <li
      className={cn(
        "bg-card animate-in fade-in-0 flex items-center gap-3 rounded-lg border px-3 py-2.5 duration-200",
        due && "border-warning/40 bg-warning/5",
      )}
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => onToggle(reminder)}
        aria-label={`Complete “${reminder.title}”`}
        className="size-6"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{reminder.title}</span>
        <span
          className={cn(
            "text-xs",
            due ? "text-warning font-medium" : "text-muted-foreground",
          )}
        >
          {formatRemindAt(reminder.remindAt)}
          {due ? " · Due" : ""}
        </span>
      </div>
    </li>
  );
}

export function TodayReminders({
  overdue,
  today,
}: {
  overdue: Reminder[];
  today: Reminder[];
}) {
  const update = useUpdateReminder();

  function toggle(reminder: Reminder) {
    update.mutate(
      { id: reminder.id, patch: { isDone: true } },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <ul className="grid gap-2">
      {overdue.map((reminder) => (
        <ReminderRow
          key={reminder.id}
          reminder={reminder}
          due
          onToggle={toggle}
        />
      ))}
      {today.map((reminder) => (
        <ReminderRow
          key={reminder.id}
          reminder={reminder}
          due={false}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Create the habit cards**

Create `src/components/today/today-habits.tsx`. Only `+1` is offered here — decrement and direct numeric entry stay on `/habits`.

```tsx
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
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/today/
git commit -m "feat: add Today view todo, reminder, and habit rows

Compact rows rather than reused module items: TodoItem requires a
DndContext, and both module items carry edit/delete/drag affordances
that do not belong on a summary screen.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Orchestrator and route

**Files:**
- Create: `src/components/today/today-view.tsx`
- Create: `src/app/(app)/today/page.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–3, plus `groupReminders` from `@/lib/reminders`, `getLocalToday` from `@/lib/utils`, `useNow` from `@/hooks/use-now`, `ErrorState` from `@/components/common/error-state`.
- Produces: `TodayView()` — no props. Route `/today`.

- [ ] **Step 1: Read the routing docs**

Per `AGENTS.md`, read `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` before adding the route. Confirm the `page.tsx` + `Metadata` export convention matches what the existing module pages do.

- [ ] **Step 2: Create the orchestrator**

Create `src/components/today/today-view.tsx`:

```tsx
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
```

- [ ] **Step 3: Create the route**

Create `src/app/(app)/today/page.tsx`, mirroring `src/app/(app)/todos/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TodayView } from "@/components/today/today-view";

export const metadata: Metadata = { title: "Today — Toreha" };

export default function TodayPage() {
  return <TodayView />;
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 5: Verify the route renders**

Start the dev server (`pnpm dev`), sign in, and navigate directly to `http://localhost:3100/today`.

Expected: the page renders with the "Today" heading and today's date, and shows whichever sections have data. There is no nav link yet — that is Task 5. Confirm the browser console shows no hydration warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/today-view.tsx "src/app/(app)/today/page.tsx"
git commit -m "feat: add /today route composing reminders, todos, and habits

Errors resolve per section so one failed query does not blank the
page. The skeleton also covers now === 0, since useNow reports 0 until
its mount effect runs.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Navigation and routing

**Files:**
- Modify: `src/proxy.ts` (`APP_ROUTES`, two redirect targets, `matcher`)
- Modify: `src/app/page.tsx:6`
- Modify: `src/components/auth/google-button.tsx:17`
- Modify: `src/components/auth/login-form.tsx:44`
- Modify: `src/components/auth/signup-form.tsx:45`
- Modify: `src/components/nav/app-nav.tsx` (`NAV_ITEMS`, tab bar grid)

**Interfaces:**
- Consumes: the `/today` route from Task 4.
- Produces: `/today` as the first nav item and the post-authentication landing page.

**Critical:** `/today` must be added to **both** `APP_ROUTES` and `matcher` in `proxy.ts`. `APP_ROUTES` decides whether an unauthenticated visitor is bounced; `matcher` decides whether the proxy runs on that path at all. Adding it to only one leaves the route unguarded at the edge, and nothing surfaces an error.

- [ ] **Step 1: Read the proxy docs**

Read `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. Note that this Next version uses `proxy.ts`, not `middleware.ts`.

- [ ] **Step 2: Update `src/proxy.ts`**

Four edits in this file.

Add `/today` to the front of `APP_ROUTES`:

```ts
const APP_ROUTES = ["/today", "/todos", "/reminders", "/habits", "/settings"];
```

Change the signed-in-hitting-an-auth-route redirect (currently `"/todos"`):

```ts
  // Signed in, hitting login/signup -> go to the app.
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/today", request.url));
  }
```

Change the root redirect (currently `hasSession ? "/todos" : "/login"`):

```ts
  // Root: route to app or login depending on session.
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSession ? "/today" : "/login", request.url),
    );
  }
```

Add the matcher entry, before `"/todos/:path*"`:

```ts
export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/today/:path*",
    "/todos/:path*",
    "/reminders/:path*",
    "/habits/:path*",
    "/settings/:path*",
  ],
};
```

- [ ] **Step 3: Update the four remaining landing targets**

`src/app/page.tsx` — change the redirect target:

```tsx
  redirect(session?.user ? "/today" : "/login");
```

`src/components/auth/google-button.tsx` — change `callbackURL`:

```tsx
        callbackURL: "/today",
```

`src/components/auth/login-form.tsx` — change the post-login push:

```tsx
    router.push("/today");
```

`src/components/auth/signup-form.tsx` — change the post-signup push:

```tsx
    router.push("/today");
```

- [ ] **Step 4: Verify no landing target was missed**

Run:

```bash
grep -rn '"/todos"' src --include='*.ts' --include='*.tsx'
```

Expected: exactly two matches, both legitimate and neither a landing target —
`src/components/nav/app-nav.tsx` (the Todos nav entry) and
`src/components/today/today-view.tsx` (the "All todos" section link).

If `src/app/page.tsx`, `src/proxy.ts`, or any file under `src/components/auth/` appears, that target was missed — fix it before continuing.

- [ ] **Step 5: Add the nav entry**

In `src/components/nav/app-nav.tsx`, add `CalendarDays` to the existing `lucide-react` import:

```tsx
import { CalendarDays, CheckSquare, Bell, Flame, Settings, LogOut } from "lucide-react";
```

Add Today as the first `NAV_ITEMS` entry:

```tsx
const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/habits", label: "Habits", icon: Flame },
] as const;
```

`MobileTabBar` derives its items from `NAV_ITEMS` plus Settings, so it picks Today up automatically.

- [ ] **Step 6: Widen the mobile tab bar**

`MobileTabBar` now renders five items but its grid is still four columns. In the `nav` element's className, change `grid-cols-4` to `grid-cols-5`:

```tsx
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/80 fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
```

Five labels in a 360px viewport leaves roughly 72px per cell, and "Reminders" overflows that. Add truncation to the label — change the `Link`'s className:

```tsx
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
```

and wrap the label text in a truncating span, replacing the bare `{item.label}`:

```tsx
            <span className="max-w-full truncate">{item.label}</span>
```

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/proxy.ts src/app/page.tsx src/components/auth/ src/components/nav/app-nav.tsx
git commit -m "feat: make Today the first nav item and landing page

Adds /today to both APP_ROUTES and the proxy matcher, and repoints all
six post-auth landing targets. Mobile tab bar widens to five columns
with truncating labels.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Full verification

**Files:** none modified — this task only runs checks and reports.

- [ ] **Step 1: Run the full check suite**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: tests pass (18), typecheck exits 0, lint exits 0, build completes and lists `/today` among the built routes.

If the build fails on a missing `TURSO_*` environment variable, the `.env` file is required — confirm it exists before assuming a code fault.

- [ ] **Step 2: Verify the authenticated landing redirect**

With the dev server running and signed in, visit `http://localhost:3100/`.
Expected: redirects to `/today`, not `/todos`.

- [ ] **Step 3: Verify the unauthenticated guard**

In a private window (no session cookie), visit `http://localhost:3100/today`.
Expected: redirects to `/login`. A redirect proves the `matcher` entry from Task 5 is live — if `/today` renders or flashes before bouncing, the matcher entry is missing.

- [ ] **Step 4: Verify each section against seeded data**

Signed in, with at least one open todo, one reminder due today or overdue, and one habit below target:

- Todos section lists open todos; with no due dates set, they appear under "Next up" (expected — see the plan's Global Constraints and spec §9).
- Reminders section lists overdue and today's reminders, overdue ones tinted with the warning border.
- Habits section shows incomplete habits with a progress ring and a `+1` button.

- [ ] **Step 5: Verify inline actions propagate to the module pages**

This is the load-bearing check for the whole "reuse the existing query keys" decision.

1. On `/today`, check off a todo. It disappears from the section. Navigate to `/todos` — it shows as completed there.
2. Back on `/today`, complete a reminder. Navigate to `/reminders` — it appears under Completed.
3. Back on `/today`, press `+1` on a habit. The ring advances. Navigate to `/habits` — the same count shows there.

If any module page shows a stale value, the shared-cache assumption is broken and must be fixed before this task is complete.

- [ ] **Step 6: Verify the completed-habits collapse**

Raise one habit to its target from `/today` using `+1`. It should move out of the actionable list into the "N done today" summary row. Click the row — it expands to show the completed habit with its streak. Click again — it collapses.

- [ ] **Step 7: Verify the all-clear state**

Complete or clear everything for the day. Expected: the "You're all set for today" panel renders. If completed habits exist, the collapsed habits summary still shows beneath it.

- [ ] **Step 8: Verify mobile layout**

Resize the browser to 360px wide. Expected: five tab bar items fit without overflow, labels truncate rather than wrap, and the page body does not scroll horizontally.

- [ ] **Step 9: Report results**

State plainly what passed and what did not, quoting actual command output for any failure. Do not claim completion for a step that was skipped.

---

## Self-Review Notes

**Spec coverage.** Every spec section maps to a task: §5.1 `selectTodayTodos` and §5.2 `splitHabits` → Task 1; §5.3 reminder reuse → Task 4 (`groupReminders` call); §6 components → Tasks 2–4; §6.1 own-rows rationale → Task 3 preamble; §6.2 habits presentation → Task 3 Step 3; §6.3 header → Task 4 Step 2; §7 three states → Tasks 2 and 4; §8 routing → Task 5; §9 dormant due-date surface → Global Constraints and Task 6 Step 4; §10 testing → Task 1 and Task 6.

**Type consistency.** `TodayTodoGroups` is the name used in both Task 1 (produced) and Task 3 (consumed) — the component is `TodayTodos`, the type is `TodayTodoGroups`, deliberately distinct. `DatedTodo` carries a non-null `dueDate` so Task 3's `format(new Date(todo.dueDate), …)` needs no assertion. `splitHabits` returns `{ incomplete, complete }`, matching `TodayHabits`'s prop names in Task 3 and the call site in Task 4.

**Known deviation from spec.** Nav icon is `CalendarDays`, not `Sun` — rationale in the File Structure section.
