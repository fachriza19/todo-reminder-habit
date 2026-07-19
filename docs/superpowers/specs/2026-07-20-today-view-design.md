# Today View — Design

**Date:** 2026-07-20
**Status:** Approved for implementation
**Scope:** One route merging due reminders, today's todos, and unlogged habits.

---

## 1. Problem

The app has three modules — Todos, Reminders, Habits — each on its own route.
Answering "what do I need to do right now?" requires visiting all three and
mentally merging them. This is the single most frequent daily question the app
should answer, and today it answers it worst.

## 2. Goals

- One screen that answers "what now?" without navigation.
- Actionable inline: check off a todo, complete a reminder, increment a habit.
- Never render as an empty shell when the user has open work.
- No new API surface, no new cache keys, no duplicated source of truth.

## 3. Non-Goals

- Creating, editing, deleting, or reordering. Those stay on the module pages.
- A due-date picker for todos (see §9, Known Dormant Surface).
- Recurring reminders, push notifications, PWA. Separate efforts.

---

## 4. Approach

Client-side composition. `TodayView` is a `"use client"` component that calls
the three existing hooks — `useTodos()`, `useReminders()`, `useHabits()` — and
runs their data through pure selection functions.

**Why not an aggregate `/api/today` endpoint:** it would introduce a fourth
TanStack cache key holding copies of rows that already live under `["todos"]`,
`["reminders"]`, and `["habits"]`. Every inline mutation would then need to
invalidate both its module key and `["today"]`, or one of the two views goes
silently stale. Reusing the existing keys means the existing mutation hooks —
`useUpdateTodo`, `useUpdateReminder`, `useLogHabit` — already keep Today and the
module pages consistent with zero new wiring.

**Why not a Server Component:** inline actions still require client hooks and the
query cache, so RSC props and cache would both hold the same data, needing a
`router.refresh()` dance to reconcile. It also breaks the established pattern
where every module view is a client component over TanStack Query.

**Cost accepted:** three parallel GETs on a cold load. They are the same requests
the module pages already issue, so every navigation after the first is a cache
hit.

---

## 5. Selection Logic — `src/lib/today.ts`

Pure functions. No React, no I/O, no `Date.now()` calls inside — time is always
passed in, which is what makes them testable.

### 5.1 `selectTodayTodos(todos, todayStart, today, cap = 5)`

Returns `{ overdue: Todo[]; dueToday: Todo[]; nextUp: Todo[] }`.

Considers open todos only (`isDone === 0`).

| Group | Predicate | Sort |
|---|---|---|
| `overdue` | `dueDate !== null && dueDate < todayStart` | `dueDate` asc, `priority` desc, `sortOrder` asc |
| `dueToday` | `dueDate !== null && localDate(dueDate) === today` | `priority` desc, `sortOrder` asc, `createdAt` asc |
| `nextUp` | `dueDate === null` | `priority` desc, `sortOrder` asc, `createdAt` asc |

**Overdue compares against `todayStart`, not `now`.** Comparing against `now`
would flip every todo due today into "overdue" one minute past local midnight,
since `dueDate` is a date-level concept.

**Cap semantics.** `overdue` and `dueToday` are never truncated — they are
genuinely due and hiding them would be a correctness bug. `nextUp` fills only
the remaining slots: `max(0, cap - overdue.length - dueToday.length)`. When
`overdue.length + dueToday.length >= cap`, `nextUp` is empty.

A todo whose `dueDate` is in the future beyond today appears in no group.

### 5.2 `splitHabits(habits)`

Returns `{ incomplete: HabitWithProgress[]; complete: HabitWithProgress[] }`,
split on `todayCount >= targetCount`, preserving the input order within each
bucket (the server already sorts by `sortOrder`, then `createdAt`).

### 5.3 Reminders — reuse, do not rewrite

`groupReminders()` in `src/lib/reminders.ts` already returns
`{ overdue, today, upcoming, completed }`. The Today view consumes `overdue` and
`today` and ignores the other two. No new function.

Reminder groups are uncapped — they are time-bound and each one is a commitment
the user made to a specific moment.

---

## 6. Components

All under `src/components/today/`.

| File | Responsibility |
|---|---|
| `today-view.tsx` | Orchestrator: hooks, selection, state routing, section assembly |
| `today-section.tsx` | Shared shell: title, count, "Show all →" link, children |
| `today-todos.tsx` | Overdue / Due today / Next up rows + toggle handler |
| `today-reminders.tsx` | Overdue / Today rows + toggle handler |
| `today-habits.tsx` | Incomplete cards + collapsed completed summary |
| `today-empty.tsx` | All-clear panel |
| `today-skeleton.tsx` | Pending state |

### 6.1 Own rows, not reused module items

Today renders its own compact rows rather than reusing `TodoItem` and
`ReminderItem`:

- `TodoItem` calls `useSortable`, hard-requiring a `DndContext` this page has no
  reason to mount.
- Both carry drag handles, edit/delete buttons, and category chips that do not
  belong on a summary screen. Reusing them would mean threading no-op handlers
  and conditional visibility props through — more coupling than value.

`ProgressRing` **is** reused unchanged, being purely presentational.

### 6.2 Habits presentation

Incomplete habits render as cards with `ProgressRing` and a single `+1` button
(no decrement, no numeric input — those stay on `/habits`). Completed habits
collapse into one summary row, `"N done today"`, that expands on click to show
the finished habits with their streaks.

### 6.3 Header

`Today` as `h1`, with the current local date beneath it (`EEEE, MMMM d` via
`date-fns`), rendered only after mount to avoid a server/client text mismatch.

---

## 7. States

**Pending.** `today-skeleton` renders while any of the three queries is pending,
**or while `now === 0`**. `useNow()` returns `0` on the server and on the first
client render, switching to the real clock in a mount effect. Treating `0` as
"not ready" avoids classifying reminders against a 1970 epoch during hydration.

**Error, per section.** A failed query shows an inline error with a retry inside
its own section; the other two sections still render. Blanking the whole page
because one of three requests failed is the wrong tradeoff for a dashboard.

**Empty.** A section with no items hides entirely. When all three are empty,
`TodayEmpty` renders the all-clear panel instead.

---

## 8. Routing and Navigation

New route `src/app/(app)/today/page.tsx`, mirroring the existing module pages:
`Metadata` export plus a single view component.

**`src/proxy.ts`** — `/today` must be added to **both** `APP_ROUTES` and
`matcher`. Adding it to only one leaves the route without its edge guard, which
fails silently.

**Landing targets.** All six repoint from `/todos` to `/today`:

1. `src/app/page.tsx:6`
2. `src/proxy.ts:28` (signed in, hitting an auth route)
3. `src/proxy.ts:34` (root redirect)
4. `src/components/auth/google-button.tsx:17` (`callbackURL`)
5. `src/components/auth/login-form.tsx:44`
6. `src/components/auth/signup-form.tsx:45`

**Nav.** `NAV_ITEMS` in `src/components/nav/app-nav.tsx` gets
`{ href: "/today", label: "Today", icon: Sun }` as the first entry. The mobile
tab bar changes `grid-cols-4` → `grid-cols-5`. `MobileTabBar` derives its items
from `NAV_ITEMS` plus Settings, so it picks up Today automatically once the grid
is widened.

---

## 9. Known Dormant Surface

`todos.dueDate` exists in the schema, validations, and service, but
`todo-form.tsx` exposes no date input — the PRD shipped it as "columns exist,
minimal UI" (T-TODO-1). Every todo therefore currently has `dueDate = null`, so
`overdue` and `dueToday` are empty in practice and `nextUp` carries the section.

This is expected and is precisely why the fallback rule was chosen. The logic is
correct for the day a picker is added; adding one is out of scope here.

---

## 10. Testing

Vitest, scoped to `src/lib/today.ts`. Pure functions, so no DOM environment, no
mocking, no React testing library.

Cases:

- Overdue vs due-today boundary at exact local midnight.
- A todo due later today is `dueToday`, not `overdue`, at any hour of that day.
- Cap: `nextUp` empty when `overdue + dueToday >= cap`.
- Cap: `nextUp` fills exactly the remaining slots.
- `overdue` and `dueToday` are never truncated by the cap.
- Done todos excluded from every group.
- Future-dated todos appear in no group.
- Priority ordering within `nextUp`; `sortOrder` as tiebreak.
- `splitHabits` at the exact target boundary (`todayCount === targetCount` is complete).
- Empty inputs return empty groups, not undefined.

Additionally verified before completion: `pnpm typecheck`, `pnpm lint`,
`pnpm build`, and driving `/today` in a browser signed in with data in all three
modules — toggling one item per section and confirming the corresponding module
page reflects the change.

---

## 11. Files

**New**

- `src/lib/today.ts`
- `src/lib/today.test.ts`
- `src/app/(app)/today/page.tsx`
- `src/components/today/{today-view,today-section,today-todos,today-reminders,today-habits,today-empty,today-skeleton}.tsx`
- `vitest.config.ts`

**Modified**

- `src/proxy.ts` — `APP_ROUTES`, `matcher`, two redirect targets
- `src/app/page.tsx` — redirect target
- `src/components/auth/{google-button,login-form,signup-form}.tsx` — landing targets
- `src/components/nav/app-nav.tsx` — `NAV_ITEMS`, tab bar grid
- `package.json` — `vitest` devDependency, `test` scripts
