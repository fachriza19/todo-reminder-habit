# Truncated Text Reveal — Design

Date: 2026-07-23

## Problem

User-generated strings (todo titles, habit names, reminder titles, category
names, notes) can be long. Today most single-line fields use CSS `truncate`
(`text-overflow: ellipsis` + `min-w-0`), so they clip to one line and do not
break layout — but there is **no way to read the full text** once clipped: no
tooltip, no `title` attribute, no expand. Some rendered fields (`todo.notes`,
category name chips, habit `unit`) have no truncation guard at all, and long
unbroken strings can still push layout in multi-line spots.

Zod schemas already cap input lengths (todo/reminder title `max(200)`,
`notes max(2000)`, habit `name max(80)`, `unit max(24)`), so the database
cannot receive unbounded text. A 200-char title still overflows a list row,
so the real fix is on the **display** side.

## Goal

A single reusable primitive that clips long user text to one line and reveals
the full text on demand, applied consistently to every place user text is
rendered. Keep list row heights uniform (no inline expansion, no layout shift).

## Decisions (confirmed with user)

- **Reveal UI:** Tooltip on hover (desktop) **plus** tap/click-to-expand
  (popover) so touch devices work too.
- **Clamp style:** Single-line ellipsis (matches current design, uniform rows).
- **Scope:** All rendered user strings **and** a light input guard
  (`maxLength` attributes matching existing zod maxes).

## Architecture

### 1. `useIsTruncated` hook

`src/hooks/use-is-truncated.ts`

- Takes a ref to the text element.
- Uses `ResizeObserver` on the element to recompute on layout changes.
- Returns `true` when `element.scrollWidth > element.clientWidth` (i.e. the
  text is actually clipped).
- Recomputes when the observed size changes; cleans up the observer on unmount.

Purpose: interactivity (cursor change, tooltip, popover trigger) only turns on
when text is genuinely truncated. Short text stays a plain, non-interactive
span — no wasted UI, no misleading cursor.

### 2. `TruncatedText` component

`src/components/common/truncated-text.tsx`

Props:

- `text: string` — the full string to render.
- `className?: string` — forwarded to the visible text element.
- `as?: "span" | "p"` — element tag, default `span`.

Behavior:

- Renders the visible text in a `truncate` element with the given ref.
- If `useIsTruncated` is `false`: render as a plain element, no trigger, no
  interactive affordance.
- If `true`: the element becomes a focusable trigger that composes two Base UI
  roots (`@base-ui/react`, already the app's primitive lib) via the `render`
  prop on a single button/trigger:
  - **Tooltip** (hover, desktop): shows full `text`, `max-w-xs`, wraps,
    `max-h-*` with `overflow-y-auto` for very long strings.
  - **Popover** (click/tap, all devices): shows full `text`, scrollable,
    closes on Escape / outside press.
- Accessibility: trigger is keyboard-focusable; `title={text}` fallback; full
  text reachable without a pointer.

The component is a drop-in replacement for existing truncated spans, e.g.
`<TruncatedText text={todo.title} className="text-sm" />`.

### 3. Apply sites

Replace directly-rendered user strings with `TruncatedText`:

- `src/components/todo/todo-item.tsx` — title span, category name span.
- `src/components/habit/habit-card.tsx` — habit name, unit/summary line.
- `src/components/reminder/reminder-item.tsx` — reminder title.
- `src/components/today/today-todos.tsx` — todo titles.
- `src/components/today/today-habits.tsx` — habit names.
- `src/components/today/today-reminders.tsx` — reminder titles.
- `src/components/todo/category-filter.tsx` — category name chips.
- `src/components/todo/category-manager.tsx` — category name rows.
- `src/components/habit/habit-detail.tsx` — habit name header, notes/unit.

(Exact fields per file confirmed during implementation by reading each file.)

### 4. Input guard (light)

Add `maxLength` attributes to the relevant inputs/textarea matching the
existing zod maxes — no schema change, purely a client affordance that stops
runaway typing and gives native browser feedback:

- todo title input → `maxLength={200}`, notes textarea → `maxLength={2000}`
- reminder title input → `maxLength={200}`
- habit name input → `maxLength={80}`, unit input → `maxLength={24}`

Files: `src/components/todo/todo-form.tsx`,
`src/components/reminder/reminder-form.tsx`,
`src/components/habit/habit-form.tsx` (and `add-todo.tsx` if it has an inline
title input).

## Testing

Vitest (existing infra):

- `useIsTruncated`: mock `scrollWidth`/`clientWidth`, assert `true` when
  content overflows and `false` when it fits; assert observer cleanup.
- `TruncatedText`: overflowing text renders an interactive trigger exposing the
  full text; short text renders a plain span with no trigger.

## Non-goals

- Multi-line clamp / inline expand (rejected: causes layout shift, non-uniform
  rows).
- Schema/DB changes (zod maxes already in place).
- Rich-text or markdown rendering of notes.
