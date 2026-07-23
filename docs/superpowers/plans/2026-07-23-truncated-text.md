# Truncated Text Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `TruncatedText` primitive that clips long user text to one line and reveals the full text on hover (tooltip) or tap (popover), and apply it everywhere user-generated text renders.

**Architecture:** A pure overflow helper (`isOverflowing`) drives a `useIsTruncated` hook (callback ref + `ResizeObserver`). `TruncatedText` renders a single-line `truncate` element and, only when it actually overflows, upgrades it into a combined Base UI Tooltip (hover) + Popover (tap) trigger. Applied to todo/habit/reminder/category/notes render sites. Input `maxLength` attributes added to match existing zod maxes.

**Tech Stack:** Next.js (client components), React, `@base-ui/react` (tooltip + popover), Tailwind, Vitest (node env, pure-function tests only).

## Global Constraints

- Testing infra is **node env, `.test.ts` only** (`vitest.config.ts` include = `src/**/*.test.ts`, `environment: "node"`). No jsdom, no React Testing Library. **Only pure functions get automated tests.** DOM/React units (hook, component, apply sites) are verified via `pnpm typecheck`, `pnpm build`, and manual app check — do NOT add jsdom/RTL.
- All new interactive components are client components — first line `"use client";`.
- Follow existing UI wrapper style (see `src/components/ui/tooltip.tsx`): Base UI primitive imported as `X as XPrimitive`, `cn()` for classes, `data-slot` attributes.
- Existing zod maxes are the source of truth for `maxLength`: todo title `200`, todo notes `2000`, reminder title `200`, habit name `80`, habit unit `24`.
- Package manager is **pnpm**. Dev server runs on port **3100**.
- Do not push, open PRs, or rebase — local commits only. Work stays on branch `feat/truncated-text`.

---

### Task 1: Pure overflow helper

**Files:**
- Create: `src/lib/text.ts`
- Test: `src/lib/text.test.ts`

**Interfaces:**
- Produces: `isOverflowing(el: { scrollWidth: number; clientWidth: number }): boolean` — `true` when horizontally clipped.

- [ ] **Step 1: Write the failing test**

`src/lib/text.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isOverflowing } from "./text";

describe("isOverflowing", () => {
  it("is true when content is wider than the box", () => {
    expect(isOverflowing({ scrollWidth: 300, clientWidth: 200 })).toBe(true);
  });

  it("is false when content fits exactly", () => {
    expect(isOverflowing({ scrollWidth: 200, clientWidth: 200 })).toBe(false);
  });

  it("is false when content is narrower than the box", () => {
    expect(isOverflowing({ scrollWidth: 120, clientWidth: 200 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/text.test.ts`
Expected: FAIL — `isOverflowing` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/text.ts`:

```ts
/** True when an element's content is horizontally clipped (ellipsis shown). */
export function isOverflowing(el: {
  scrollWidth: number;
  clientWidth: number;
}): boolean {
  return el.scrollWidth > el.clientWidth;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/text.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/text.ts src/lib/text.test.ts
git commit -m "feat: add isOverflowing text helper"
```

---

### Task 2: useIsTruncated hook

**Files:**
- Create: `src/hooks/use-is-truncated.ts`

**Interfaces:**
- Consumes: `isOverflowing` from `src/lib/text.ts`.
- Produces: `useIsTruncated<T extends HTMLElement = HTMLElement>(): { ref: (node: T | null) => void; truncated: boolean }` — attach `ref` to the text element; `truncated` reflects live clip state, updated on resize.

**Note on testing:** DOM-dependent (ResizeObserver). No automated test per Global Constraints — verified by typecheck + the app in later tasks.

- [ ] **Step 1: Write the hook**

`src/hooks/use-is-truncated.ts`:

```ts
"use client";

import { useCallback, useRef, useState } from "react";

import { isOverflowing } from "@/lib/text";

/**
 * Reports whether the attached element's text is horizontally clipped.
 * Uses a callback ref so the ResizeObserver re-attaches if the node swaps
 * (e.g. when the element is upgraded to an interactive trigger).
 */
export function useIsTruncated<T extends HTMLElement = HTMLElement>(): {
  ref: (node: T | null) => void;
  truncated: boolean;
} {
  const [truncated, setTruncated] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;

    const measure = () => setTruncated(isOverflowing(node));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    observerRef.current = ro;
  }, []);

  return { ref, truncated };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-is-truncated.ts
git commit -m "feat: add useIsTruncated hook"
```

---

### Task 3: Popover UI wrapper

**Files:**
- Create: `src/components/ui/popover.tsx`

**Interfaces:**
- Produces: `Popover`, `PopoverTrigger`, `PopoverContent` (re-exports/wrappers over `@base-ui/react/popover`), mirroring the tooltip wrapper's API and styling conventions.

**Note:** No wrapper exists yet; `@base-ui/react/popover` is installed. Verified by typecheck + app.

- [ ] **Step 1: Write the wrapper**

`src/components/ui/popover.tsx`:

```tsx
"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 max-h-64 max-w-xs origin-(--transform-origin) overflow-y-auto rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md whitespace-pre-wrap break-words data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS. If Base UI prop-type names differ, adjust the `Pick<...>` / prop names to match the installed types (compare against `src/components/ui/tooltip.tsx`, which uses the same primitive shapes).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/popover.tsx
git commit -m "feat: add popover ui wrapper"
```

---

### Task 4: TruncatedText component

**Files:**
- Create: `src/components/common/truncated-text.tsx`

**Interfaces:**
- Consumes: `useIsTruncated` (Task 2), `Popover`/`PopoverTrigger`/`PopoverContent` (Task 3), `Tooltip`/`TooltipTrigger`/`TooltipContent` from `src/components/ui/tooltip.tsx`, `cn`.
- Produces: `TruncatedText({ text, className?, as? }: { text: string; className?: string; as?: "span" | "p" })`.

**Behavior contract:**
- Renders `text` in a `truncate` element carrying the hook ref.
- When not truncated: plain element, no cursor change, no tooltip/popover.
- When truncated: same element becomes a combined Tooltip (hover) + Popover (tap/click) trigger showing full `text`; `title={text}` fallback.
- **Metric stability:** the visible element uses the identical class string in both branches so upgrading to a trigger does not change its measured width (prevents truncated-state oscillation).

**Note:** DOM/React composition — verified by typecheck + build + manual app check (Task 8), not automated tests.

- [ ] **Step 1: Write the component**

`src/components/common/truncated-text.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useIsTruncated } from "@/hooks/use-is-truncated";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function TruncatedText({
  text,
  className,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  as?: "span" | "p";
}) {
  const { ref, truncated } = useIsTruncated<HTMLElement>();
  // Identical classes in both branches keep the measured width stable.
  const textClass = cn("block truncate", className);

  if (!truncated) {
    return (
      <Tag ref={ref} className={textClass}>
        {text}
      </Tag>
    );
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Tag
                  ref={ref}
                  title={text}
                  className={cn(textClass, "cursor-pointer text-left")}
                />
              }
            />
          }
        >
          {text}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-wrap break-words">
          {text}
        </TooltipContent>
      </Tooltip>
      <PopoverContent>{text}</PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS. If the nested `render`-prop composition raises a ref/type error, keep the ref on the innermost `<Tag>` and confirm Base UI merges refs/props through `render` (same mechanism `tooltip.tsx` relies on); adjust nesting order (Popover outer, Tooltip inner) only if needed to satisfy the types.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/truncated-text.tsx
git commit -m "feat: add TruncatedText component"
```

---

### Task 5: Apply to list items (todo, reminder, habit)

**Files:**
- Modify: `src/components/todo/todo-item.tsx` (title span ~L73-80; category name span ~L99-101)
- Modify: `src/components/reminder/reminder-item.tsx` (title span ~L52-59)
- Modify: `src/components/habit/habit-card.tsx` (name `<p>` ~L62)

**Interfaces:**
- Consumes: `TruncatedText` (Task 4).

**Note:** UI edits — verified by typecheck + build + manual app check (Task 8).

- [ ] **Step 1: Update `todo-item.tsx`**

Add import near the other component imports:

```tsx
import { TruncatedText } from "@/components/common/truncated-text";
```

Replace the title `<span>` (currently):

```tsx
        <span
          className={cn(
            "truncate text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {todo.title}
        </span>
```

with:

```tsx
        <TruncatedText
          text={todo.title}
          className={cn(
            "text-sm",
            done && "text-muted-foreground line-through",
          )}
        />
```

Replace the category name `<span>` (currently):

```tsx
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {category.name}
          </span>
```

with:

```tsx
          <TruncatedText
            text={category.name}
            className="text-muted-foreground hidden max-w-24 text-xs sm:block"
          />
```

- [ ] **Step 2: Update `reminder-item.tsx`**

Add the import:

```tsx
import { TruncatedText } from "@/components/common/truncated-text";
```

Replace the title `<span>`:

```tsx
        <span
          className={cn(
            "truncate text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {reminder.title}
        </span>
```

with:

```tsx
        <TruncatedText
          text={reminder.title}
          className={cn(
            "text-sm",
            done && "text-muted-foreground line-through",
          )}
        />
```

- [ ] **Step 3: Update `habit-card.tsx`**

Add the import:

```tsx
import { TruncatedText } from "@/components/common/truncated-text";
```

Replace the name `<p>`:

```tsx
          <p className="truncate font-medium">{habit.name}</p>
```

with:

```tsx
          <TruncatedText as="p" text={habit.name} className="font-medium" />
```

- [ ] **Step 4: Verify typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS (build completes).

- [ ] **Step 5: Commit**

```bash
git add src/components/todo/todo-item.tsx src/components/reminder/reminder-item.tsx src/components/habit/habit-card.tsx
git commit -m "feat: use TruncatedText in todo/reminder/habit list items"
```

---

### Task 6: Apply to Today view, category chips, habit detail

**Files:**
- Modify: `src/components/today/today-todos.tsx`
- Modify: `src/components/today/today-habits.tsx`
- Modify: `src/components/today/today-reminders.tsx`
- Modify: `src/components/todo/category-filter.tsx` (chip label)
- Modify: `src/components/todo/category-manager.tsx` (category name row)
- Modify: `src/components/habit/habit-detail.tsx` (habit name header, unit/notes if rendered)

**Interfaces:**
- Consumes: `TruncatedText` (Task 4).

**Note:** These files were not read line-by-line in planning. For each: read the file, find every place a user string (`todo.title`, `habit.name`, `reminder.title`, `category.name`, notes) is rendered directly in text, and replace that element with `<TruncatedText text={...} className={...} />`, preserving the existing text classes (drop any redundant `truncate` from the className since `TruncatedText` adds it). Add the import to each file. For the category chip in `category-filter.tsx`, wrap only the name label — keep the color dot and chip layout intact; constrain with `max-w-32` so a long name can't stretch the chip past the row.

**DOM edits — verified by typecheck + build + manual app check (Task 8).**

- [ ] **Step 1: Update `today-todos.tsx`, `today-habits.tsx`, `today-reminders.tsx`**

For each file: add `import { TruncatedText } from "@/components/common/truncated-text";` and replace each directly-rendered title/name span with `<TruncatedText text={...} className={...} />`, carrying over the existing text-size / color / line-through classes and removing any now-redundant `truncate`.

- [ ] **Step 2: Update `category-filter.tsx` and `category-manager.tsx`**

Add the import to each. In `category-filter.tsx`, wrap the category name label passed as `Chip` children with `<TruncatedText text={c.name} className="max-w-32" />`. In `category-manager.tsx`, replace the rendered `category.name` element with `<TruncatedText text={category.name} className={...existing text classes...} />`.

- [ ] **Step 3: Update `habit-detail.tsx`**

Add the import. Wrap the habit name header and any rendered `unit`/notes string with `<TruncatedText ... />`, keeping existing typography classes.

- [ ] **Step 4: Verify typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/today src/components/todo/category-filter.tsx src/components/todo/category-manager.tsx src/components/habit/habit-detail.tsx
git commit -m "feat: use TruncatedText across today view, categories, habit detail"
```

---

### Task 7: Input maxLength guards

**Files:**
- Modify: `src/components/todo/todo-form.tsx` (title Input ~L112; notes Textarea ~L125)
- Modify: `src/components/todo/add-todo.tsx` (inline title Input ~L38)
- Modify: `src/components/reminder/reminder-form.tsx` (title Input ~L115)
- Modify: `src/components/habit/habit-form.tsx` (name Input ~L120; unit Input ~L154)

**Interfaces:** none (attribute-only edits).

**Note:** Purely additive `maxLength` attributes matching existing zod maxes. No schema change. Verified by typecheck + build.

- [ ] **Step 1: `todo-form.tsx`**

Title input:

```tsx
                    <Input maxLength={200} placeholder="What needs doing?" {...field} />
```

Notes textarea:

```tsx
                    <Textarea maxLength={2000} rows={3} placeholder="Optional details" {...field} />
```

- [ ] **Step 2: `add-todo.tsx`**

Title input — add `maxLength={200}`:

```tsx
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        aria-label="Add a task"
        maxLength={200}
        className="h-11"
        autoComplete="off"
      />
```

- [ ] **Step 3: `reminder-form.tsx`**

Title input:

```tsx
                    <Input maxLength={200} placeholder="Call the dentist" {...field} />
```

- [ ] **Step 4: `habit-form.tsx`**

Name input:

```tsx
                    <Input maxLength={80} placeholder="Drink water" {...field} />
```

Unit input:

```tsx
                      <Input maxLength={24} placeholder="glasses" {...field} />
```

- [ ] **Step 5: Verify typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/todo/todo-form.tsx src/components/todo/add-todo.tsx src/components/reminder/reminder-form.tsx src/components/habit/habit-form.tsx
git commit -m "feat: cap text inputs with maxLength matching validation"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Lint, typecheck, tests, build**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 2: Manual app check**

Run `pnpm dev` (port 3100). For each of Todos, Today, Habits, Reminders:
- Create an item with a very long title (paste ~150+ chars, or a long unbroken string like `aaaa…`).
- Confirm the row stays single-line, does not widen the layout, and shows an ellipsis.
- Hover the clipped text → tooltip shows full text (desktop).
- Click/tap the clipped text → popover shows full text, scrollable, closes on Escape / outside click.
- Confirm short items show **no** tooltip/popover and no pointer cursor.
- Narrow the window until a normally-short title clips → tooltip/popover activate (ResizeObserver path). Confirm no flicker/oscillation.

- [ ] **Step 3: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: truncated-text verification cleanup"
```

(Skip if nothing changed.)

---

## Self-Review

**Spec coverage:**
- `useIsTruncated` hook → Task 2. ✓
- `TruncatedText` component (hover tooltip + tap popover, overflow-gated) → Tasks 3–4. ✓
- Apply sites (todo-item, habit-card, reminder-item, today-*, category-filter, category-manager, habit-detail) → Tasks 5–6. ✓
- Input guard (`maxLength` matching zod maxes) → Task 7. ✓
- Testing within existing node/`.test.ts` infra (pure fn) → Task 1; DOM units verified via typecheck/build/app per Global Constraints. ✓
- Non-goals (multi-line clamp, schema change) — not present in plan. ✓

**Placeholder scan:** Task 6 intentionally defers exact line edits to read-then-replace because those files were not read in planning; each step names the exact fields, the transformation, and the classes to preserve — concrete enough to execute without invention.

**Type consistency:** `isOverflowing` signature consistent (Task 1 ↔ Task 2). `useIsTruncated` returns `{ ref, truncated }` used exactly so in Task 4. `TruncatedText({ text, className, as })` signature consistent across Tasks 5–6. Popover wrapper exports (`Popover`, `PopoverTrigger`, `PopoverContent`) match Task 4 imports.
