# Expenses P1 (Ledger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the expenses ledger — log expenses and income against categories and accounts, and read them back as a month view with day grouping and totals.

**Architecture:** A fourth domain module following the blueprint in `PRD-personal-productivity-app.md` §5A exactly: Drizzle schema → Zod validations → pure services taking `userId` → thin route handlers → TanStack Query hooks → components. All money is integer minor units; all dates are `'YYYY-MM-DD'` local strings. Day grouping, totals and optimistic cache patching live in one pure module (`src/lib/expenses.ts`) so they are unit-testable in the existing node-environment Vitest setup and shared by both server and client.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + Turso/libSQL, Zod 4, TanStack Query 5, Zustand 5, Base UI + shadcn components, Tailwind 4, date-fns, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-07-27-expenses-tracking-design.md`
**Prototype:** https://claude.ai/code/artifact/16f2b2ec-e03a-42e1-8cc4-5d0ff872a2c4

## Global Constraints

- **Read the Next.js docs before writing route/page code.** Per `AGENTS.md`, this is not the Next.js in your training data — check `node_modules/next/dist/docs/` for the relevant guide and heed deprecation notices.
- **Money is never a float.** `amountMinor` is a positive integer in the DB, the API, and React state. IDR has `decimals: 0`, so one minor unit is one rupiah. Max accepted value: `999_999_999_999`.
- **Dates are `'YYYY-MM-DD'` local strings.** "Today" comes only from `getLocalToday()` in `src/lib/utils.ts` (PRD §5A.5). Never construct dates ad hoc.
- **Timestamps are epoch ms** via `epochNow()`; **ids** via `newId()` (both from `src/lib/utils.ts`).
- **Every query is scoped to `user_id`.** A client-supplied `categoryId` or `accountId` must be proven to belong to the session user before it is written.
- **API responses use the uniform contract** from `src/lib/api.ts`: `ok(data)` / `AppError(code, message)`, wrapped in `handle()`.
- **Mutations are optimistic** with the `onMutate` snapshot → patch → `onError` rollback → `onSettled` invalidate pattern (see `src/hooks/use-todos.ts`).
- **Every list has three states:** empty, loading (skeleton), error (PRD §5B.4).
- **Microcopy is sentence case, active voice.** Buttons name their action.
- **Tap targets ≥44px; `min-w-0` on list row roots** so long text truncates instead of overflowing (see `docs/superpowers/specs/2026-07-23-truncated-text-design.md`).
- **Run `pnpm lint`, `pnpm typecheck`, `pnpm test` before every commit.**

## Explicitly out of scope for P1

Named so nobody builds them early or thinks they were forgotten:

- **Budgets, insights, recurring rules, CSV export** — P2 and P3. Their tables ship in Task 3 (one migration is cheaper than two), but no service, endpoint or UI touches them.
- **The filter popover** (spec §7.2). `listMonth` accepts `type`, `categoryId`, `accountId` and `q`, and `GET /api/transactions` already exposes them — the UI control lands in P2 alongside insights, which needs the same picker components.
- **Category and account management UI**, including the trailing "＋ New" chip in the sheet. P1 ships the seeded defaults, which are enough to log anything; `useCreateFinanceCategory` exists for P2 to wire up. Renaming and archiving are API-only until then.
- **Desktop inline add row** (spec §7.3). P1 uses the same sheet on both breakpoints via `ResponsiveModal`; the keyboard-first inline row is a P2 refinement.

---

### Task 0: Branch

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/expenses
```

---

### Task 1: Money helpers

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CURRENCY: { code: "IDR"; symbol: "Rp"; decimals: 0; locale: "id-ID" }`
  - `MAX_AMOUNT_MINOR: 999_999_999_999`
  - `formatMoney(minor: number): string` → `"Rp 25.000"`
  - `formatMoneyCompact(minor: number): string` → `"25.000"`
  - `formatSigned(minor: number, type: "expense" | "income"): string` → `"−25.000"` / `"+25.000"`
  - `parseAmountInput(raw: string): number`
  - `type NumpadKey = "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"000"|"del"|"clear"`
  - `applyNumpadKey(digits: string, key: NumpadKey): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_MINOR,
  applyNumpadKey,
  formatMoney,
  formatMoneyCompact,
  formatSigned,
  parseAmountInput,
} from "./money";

describe("formatMoney", () => {
  it("groups thousands with dots and prefixes the symbol", () => {
    expect(formatMoney(25000)).toBe("Rp 25.000");
    expect(formatMoney(2100000)).toBe("Rp 2.100.000");
  });

  it("renders zero without decimals", () => {
    expect(formatMoney(0)).toBe("Rp 0");
  });

  it("renders the maximum accepted amount", () => {
    expect(formatMoney(MAX_AMOUNT_MINOR)).toBe("Rp 999.999.999.999");
  });
});

describe("formatMoneyCompact", () => {
  it("omits the currency symbol for dense columns", () => {
    expect(formatMoneyCompact(118000)).toBe("118.000");
  });
});

describe("formatSigned", () => {
  it("prefixes a minus for expenses and a plus for income", () => {
    expect(formatSigned(25000, "expense")).toBe("−25.000");
    expect(formatSigned(2500000, "income")).toBe("+2.500.000");
  });

  it("leaves zero unsigned", () => {
    expect(formatSigned(0, "expense")).toBe("0");
  });
});

describe("parseAmountInput", () => {
  it("strips grouping separators", () => {
    expect(parseAmountInput("25.000")).toBe(25000);
    expect(parseAmountInput("2,500,000")).toBe(2500000);
  });

  it("accepts a bare digit string", () => {
    expect(parseAmountInput("25000")).toBe(25000);
  });

  it("ignores currency symbols, spaces and letters", () => {
    expect(parseAmountInput("Rp 25.000 ")).toBe(25000);
    expect(parseAmountInput("abc")).toBe(0);
  });

  it("returns zero for an empty string", () => {
    expect(parseAmountInput("")).toBe(0);
  });

  it("clamps above the maximum", () => {
    expect(parseAmountInput("99999999999999999")).toBe(MAX_AMOUNT_MINOR);
  });

  it("round-trips through formatMoneyCompact", () => {
    expect(parseAmountInput(formatMoneyCompact(1234567))).toBe(1234567);
  });
});

describe("applyNumpadKey", () => {
  it("appends digits", () => {
    expect(applyNumpadKey("", "2")).toBe("2");
    expect(applyNumpadKey("2", "5")).toBe("25");
  });

  it("appends three zeroes for the 000 key", () => {
    expect(applyNumpadKey("25", "000")).toBe("25000");
  });

  it("never produces a leading zero", () => {
    expect(applyNumpadKey("", "0")).toBe("");
    expect(applyNumpadKey("", "000")).toBe("");
    expect(applyNumpadKey("1", "0")).toBe("10");
  });

  it("deletes the last digit", () => {
    expect(applyNumpadKey("250", "del")).toBe("25");
    expect(applyNumpadKey("", "del")).toBe("");
  });

  it("clears everything", () => {
    expect(applyNumpadKey("250000", "clear")).toBe("");
  });

  it("refuses input past the maximum", () => {
    const atMax = String(MAX_AMOUNT_MINOR);
    expect(applyNumpadKey(atMax, "9")).toBe(atMax);
    expect(applyNumpadKey(atMax, "000")).toBe(atMax);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/money.test.ts`
Expected: FAIL — `Failed to resolve import "./money"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/money.ts`:

```ts
/**
 * The single source of truth for money formatting and parsing.
 *
 * Money is stored, transported and held in state as an integer number of minor
 * units — never a float. IDR has no subunit (`decimals: 0`), so one minor unit
 * is one rupiah. Keeping the scale in this constant means adding a second
 * currency later is additive, with no data migration.
 */
export const CURRENCY = {
  code: "IDR",
  symbol: "Rp",
  decimals: 0,
  locale: "id-ID",
} as const;

/** ~1 trillion rupiah: far inside MAX_SAFE_INTEGER, small enough to catch typos. */
export const MAX_AMOUNT_MINOR = 999_999_999_999;

const MAX_DIGITS = String(MAX_AMOUNT_MINOR).length;

/** `25000` → `"25.000"`. No currency symbol — for dense columns. */
export function formatMoneyCompact(minor: number): string {
  return minor.toLocaleString(CURRENCY.locale, {
    minimumFractionDigits: CURRENCY.decimals,
    maximumFractionDigits: CURRENCY.decimals,
  });
}

/** `25000` → `"Rp 25.000"`. */
export function formatMoney(minor: number): string {
  return `${CURRENCY.symbol} ${formatMoneyCompact(minor)}`;
}

/**
 * `25000, "expense"` → `"−25.000"`. Uses a true minus sign (U+2212), which
 * aligns with digits far better than a hyphen. Zero stays unsigned — "−0" is
 * noise.
 */
export function formatSigned(
  minor: number,
  type: "expense" | "income",
): string {
  const body = formatMoneyCompact(minor);
  if (minor === 0) return body;
  return `${type === "income" ? "+" : "−"}${body}`;
}

/**
 * Parse anything a human or a paste buffer might contain into minor units.
 * Only digits survive, so grouping separators, the currency symbol and stray
 * letters are all handled by the same rule.
 */
export function parseAmountInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  const value = Number(digits.slice(0, MAX_DIGITS + 1));
  return Math.min(value, MAX_AMOUNT_MINOR);
}

export type NumpadKey =
  | "0" | "1" | "2" | "3" | "4"
  | "5" | "6" | "7" | "8" | "9"
  | "000"
  | "del"
  | "clear";

/**
 * Reducer for the in-sheet numpad. Kept pure and separate from the component so
 * the fiddly rules — no leading zero, the 000 key, the ceiling — are testable.
 */
export function applyNumpadKey(digits: string, key: NumpadKey): string {
  if (key === "clear") return "";
  if (key === "del") return digits.slice(0, -1);

  // A leading zero is never meaningful, and "000" on an empty field is a no-op.
  if (digits === "" && /^0+$/.test(key)) return "";

  const next = digits + key;
  if (next.length > MAX_DIGITS) return digits;
  if (Number(next) > MAX_AMOUNT_MINOR) return digits;
  return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/money.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat(expenses): add integer money formatting and numpad reducer"
```

---

### Task 2: Month and ledger helpers

**Files:**
- Create: `src/lib/expenses.ts`
- Test: `src/lib/expenses.test.ts`

**Interfaces:**
- Consumes: `getLocalToday()` from `src/lib/utils.ts`; `date-fns`.
- Produces:
  - `type TransactionType = "expense" | "income"`
  - `type MonthKey = string` (`'YYYY-MM'`)
  - `type LedgerRow = { id: string; type: TransactionType; amountMinor: number; occurredOn: string }` — the minimum shape the pure helpers need; richer rows satisfy it structurally.
  - `type DayGroup<T extends LedgerRow> = { date: string; expenseMinor: number; incomeMinor: number; items: T[] }`
  - `type LedgerTotals = { expenseMinor: number; incomeMinor: number; netMinor: number }`
  - `type MonthLedger<T extends LedgerRow> = { days: DayGroup<T>[]; totals: LedgerTotals }`
  - `currentMonthKey(today?: string): MonthKey`
  - `monthKeyOf(date: string): MonthKey`
  - `isValidMonthKey(value: string): boolean`
  - `shiftMonth(key: MonthKey, delta: number): MonthKey`
  - `monthBounds(key: MonthKey): { start: string; end: string }`
  - `formatMonthLabel(key: MonthKey): string`
  - `formatDayLabel(date: string, today: string): string`
  - `buildLedger<T extends LedgerRow>(rows: T[]): MonthLedger<T>`
  - `ledgerInsert<T extends LedgerRow>(ledger: MonthLedger<T>, row: T): MonthLedger<T>`
  - `ledgerRemove<T extends LedgerRow>(ledger: MonthLedger<T>, id: string): MonthLedger<T>`
  - `ledgerReplace<T extends LedgerRow>(ledger: MonthLedger<T>, id: string, row: T): MonthLedger<T>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/expenses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildLedger,
  currentMonthKey,
  formatDayLabel,
  formatMonthLabel,
  isValidMonthKey,
  ledgerInsert,
  ledgerRemove,
  ledgerReplace,
  monthBounds,
  monthKeyOf,
  shiftMonth,
  type LedgerRow,
} from "./expenses";

const row = (
  id: string,
  occurredOn: string,
  amountMinor: number,
  type: "expense" | "income" = "expense",
): LedgerRow => ({ id, occurredOn, amountMinor, type });

describe("month keys", () => {
  it("derives a month key from a date", () => {
    expect(monthKeyOf("2026-07-27")).toBe("2026-07");
  });

  it("derives the current month from today", () => {
    expect(currentMonthKey("2026-07-27")).toBe("2026-07");
  });

  it("validates the shape", () => {
    expect(isValidMonthKey("2026-07")).toBe(true);
    expect(isValidMonthKey("2026-7")).toBe(false);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("nope")).toBe(false);
  });

  it("shifts across a year boundary in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-07", 0)).toBe("2026-07");
  });

  it("returns inclusive bounds, handling short and leap months", () => {
    expect(monthBounds("2026-07")).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
    expect(monthBounds("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(monthBounds("2028-02").end).toBe("2028-02-29");
  });

  it("labels a month for humans", () => {
    expect(formatMonthLabel("2026-07")).toBe("July 2026");
  });
});

describe("formatDayLabel", () => {
  it("names today and yesterday", () => {
    expect(formatDayLabel("2026-07-27", "2026-07-27")).toBe("Today · Sat 27 Jul");
    expect(formatDayLabel("2026-07-26", "2026-07-27")).toBe(
      "Yesterday · Fri 26 Jul",
    );
  });

  it("uses a plain date for any other day", () => {
    expect(formatDayLabel("2026-07-25", "2026-07-27")).toBe("Thu 25 Jul");
  });
});

describe("buildLedger", () => {
  it("groups by day, newest day first, and subtotals each side", () => {
    const ledger = buildLedger([
      row("a", "2026-07-25", 100000),
      row("b", "2026-07-27", 25000),
      row("c", "2026-07-26", 2500000, "income"),
      row("d", "2026-07-26", 65000),
    ]);

    expect(ledger.days.map((d) => d.date)).toEqual([
      "2026-07-27",
      "2026-07-26",
      "2026-07-25",
    ]);
    expect(ledger.days[1]).toMatchObject({
      date: "2026-07-26",
      expenseMinor: 65000,
      incomeMinor: 2500000,
    });
    expect(ledger.days[1].items.map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("totals the whole month with a net figure", () => {
    const ledger = buildLedger([
      row("a", "2026-07-27", 25000),
      row("b", "2026-07-26", 2500000, "income"),
    ]);
    expect(ledger.totals).toEqual({
      expenseMinor: 25000,
      incomeMinor: 2500000,
      netMinor: 2475000,
    });
  });

  it("returns an empty ledger for no rows", () => {
    expect(buildLedger([])).toEqual({
      days: [],
      totals: { expenseMinor: 0, incomeMinor: 0, netMinor: 0 },
    });
  });
});

describe("ledger mutations", () => {
  const base = buildLedger([
    row("a", "2026-07-27", 25000),
    row("b", "2026-07-25", 100000),
  ]);

  it("inserts into an existing day and re-totals", () => {
    const next = ledgerInsert(base, row("c", "2026-07-27", 5000));
    expect(next.days[0].items.map((i) => i.id)).toEqual(["c", "a"]);
    expect(next.days[0].expenseMinor).toBe(30000);
    expect(next.totals.expenseMinor).toBe(130000);
  });

  it("creates a new day in the right position", () => {
    const next = ledgerInsert(base, row("c", "2026-07-26", 5000));
    expect(next.days.map((d) => d.date)).toEqual([
      "2026-07-27",
      "2026-07-26",
      "2026-07-25",
    ]);
  });

  it("does not mutate the input ledger", () => {
    ledgerInsert(base, row("c", "2026-07-27", 5000));
    expect(base.days[0].items).toHaveLength(1);
    expect(base.totals.expenseMinor).toBe(125000);
  });

  it("removes a row and drops the day when it empties", () => {
    const next = ledgerRemove(base, "b");
    expect(next.days.map((d) => d.date)).toEqual(["2026-07-27"]);
    expect(next.totals.expenseMinor).toBe(25000);
  });

  it("ignores a removal of an unknown id", () => {
    expect(ledgerRemove(base, "zzz")).toEqual(base);
  });

  it("replaces a row, moving it when the date changed", () => {
    const next = ledgerReplace(base, "a", row("a", "2026-07-25", 1000));
    expect(next.days.map((d) => d.date)).toEqual(["2026-07-25"]);
    expect(next.days[0].expenseMinor).toBe(101000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/expenses.test.ts`
Expected: FAIL — `Failed to resolve import "./expenses"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/expenses.ts`:

```ts
import { addMonths, format, lastDayOfMonth, parseISO, subDays } from "date-fns";
import { getLocalToday } from "@/lib/utils";

export type TransactionType = "expense" | "income";

/** `'YYYY-MM'`. The unit budgets, salaries and this whole module work in. */
export type MonthKey = string;

/**
 * The minimum shape the pure ledger helpers need. Richer rows (with category
 * and account objects attached) satisfy it structurally, so the same functions
 * serve the service layer and the client cache.
 */
export type LedgerRow = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  occurredOn: string;
};

export type DayGroup<T extends LedgerRow> = {
  date: string;
  expenseMinor: number;
  incomeMinor: number;
  items: T[];
};

export type LedgerTotals = {
  expenseMinor: number;
  incomeMinor: number;
  netMinor: number;
};

export type MonthLedger<T extends LedgerRow> = {
  days: DayGroup<T>[];
  totals: LedgerTotals;
};

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthKeyOf(date: string): MonthKey {
  return date.slice(0, 7);
}

export function currentMonthKey(today: string = getLocalToday()): MonthKey {
  return monthKeyOf(today);
}

export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY_RE.test(value);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  return format(addMonths(parseISO(`${key}-01`), delta), "yyyy-MM");
}

/** Inclusive `'YYYY-MM-DD'` bounds, so a month query is a plain BETWEEN. */
export function monthBounds(key: MonthKey): { start: string; end: string } {
  const first = parseISO(`${key}-01`);
  return {
    start: format(first, "yyyy-MM-dd"),
    end: format(lastDayOfMonth(first), "yyyy-MM-dd"),
  };
}

export function formatMonthLabel(key: MonthKey): string {
  return format(parseISO(`${key}-01`), "MMMM yyyy");
}

/** `"Today · Sat 27 Jul"`, `"Yesterday · Fri 26 Jul"`, or `"Thu 25 Jul"`. */
export function formatDayLabel(date: string, today: string): string {
  const stamp = format(parseISO(date), "EEE d MMM");
  if (date === today) return `Today · ${stamp}`;
  const yesterday = format(subDays(parseISO(today), 1), "yyyy-MM-dd");
  if (date === yesterday) return `Yesterday · ${stamp}`;
  return stamp;
}

function emptyTotals(): LedgerTotals {
  return { expenseMinor: 0, incomeMinor: 0, netMinor: 0 };
}

function totalsOf<T extends LedgerRow>(days: DayGroup<T>[]): LedgerTotals {
  const expenseMinor = days.reduce((sum, d) => sum + d.expenseMinor, 0);
  const incomeMinor = days.reduce((sum, d) => sum + d.incomeMinor, 0);
  return { expenseMinor, incomeMinor, netMinor: incomeMinor - expenseMinor };
}

function dayOf<T extends LedgerRow>(date: string, items: T[]): DayGroup<T> {
  return {
    date,
    expenseMinor: items
      .filter((i) => i.type === "expense")
      .reduce((s, i) => s + i.amountMinor, 0),
    incomeMinor: items
      .filter((i) => i.type === "income")
      .reduce((s, i) => s + i.amountMinor, 0),
    items,
  };
}

/**
 * Group rows into days, newest day first. Row order inside a day is preserved,
 * so the caller decides it (the service orders by created_at desc, which puts
 * the most recently logged entry on top of its day).
 */
export function buildLedger<T extends LedgerRow>(rows: T[]): MonthLedger<T> {
  if (rows.length === 0) return { days: [], totals: emptyTotals() };

  const byDate = new Map<string, T[]>();
  for (const r of rows) {
    const bucket = byDate.get(r.occurredOn);
    if (bucket) bucket.push(r);
    else byDate.set(r.occurredOn, [r]);
  }

  const days = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => dayOf(date, items));

  return { days, totals: totalsOf(days) };
}

function rebuild<T extends LedgerRow>(rows: T[]): MonthLedger<T> {
  return buildLedger(rows);
}

function flatten<T extends LedgerRow>(ledger: MonthLedger<T>): T[] {
  return ledger.days.flatMap((d) => d.items);
}

/** Optimistic insert: the new row lands at the top of its day. */
export function ledgerInsert<T extends LedgerRow>(
  ledger: MonthLedger<T>,
  row: T,
): MonthLedger<T> {
  const rows = flatten(ledger);
  const sameDayIndex = rows.findIndex((r) => r.occurredOn === row.occurredOn);
  if (sameDayIndex === -1) return rebuild([...rows, row]);
  return rebuild([
    ...rows.slice(0, sameDayIndex),
    row,
    ...rows.slice(sameDayIndex),
  ]);
}

export function ledgerRemove<T extends LedgerRow>(
  ledger: MonthLedger<T>,
  id: string,
): MonthLedger<T> {
  const rows = flatten(ledger);
  if (!rows.some((r) => r.id === id)) return ledger;
  return rebuild(rows.filter((r) => r.id !== id));
}

export function ledgerReplace<T extends LedgerRow>(
  ledger: MonthLedger<T>,
  id: string,
  row: T,
): MonthLedger<T> {
  const rows = flatten(ledger);
  if (!rows.some((r) => r.id === id)) return ledger;
  return rebuild(rows.map((r) => (r.id === id ? row : r)));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/expenses.test.ts`
Expected: PASS.

> If `formatDayLabel` fails, simplify it: the yesterday calculation should use `date-fns` `subDays(parseISO(today), 1)` formatted as `yyyy-MM-dd`. Remove the unused `yesterday`/`void` lines — they are leftovers and lint will flag them.

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/lib/expenses.ts src/lib/expenses.test.ts
git commit -m "feat(expenses): add month key and ledger grouping helpers"
```

---

### Task 3: Schema and migration

**Files:**
- Modify: `src/db/schema.ts` (append after `habitLogs`, before the relations block)
- Generated: `src/db/migrations/*.sql`

**Interfaces:**
- Consumes: existing `user` table.
- Produces: tables `financeCategories`, `accounts`, `transactions`, `budgets`, `recurringRules`; types `FinanceCategory`, `Account`, `Transaction`, `Budget`, `RecurringRule`.

> All five tables land in one migration even though budgets and recurring rules are not used until P2/P3. `transactions.recurring_id` references `recurring_rules`, and splitting the migration would mean altering the table later — SQLite makes that painful.

- [ ] **Step 1: Add the tables**

In `src/db/schema.ts`, add `index` to the existing `drizzle-orm/sqlite-core` import, then append after `habitLogs`:

```ts
/* ------------------------------------------------------------------ */
/* Expenses module (spec 2026-07-27). Money = integer minor units;     */
/* occurred_on = local 'YYYY-MM-DD' like habit_logs.date.              */
/* ------------------------------------------------------------------ */

export const financeCategories = sqliteTable("finance_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'expense' | 'income'
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'cash' | 'bank' | 'ewallet' | 'card'
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const recurringRules = sqliteTable("recurring_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  categoryId: text("category_id").references(() => financeCategories.id, {
    onDelete: "set null",
  }),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  note: text("note"),
  frequency: text("frequency").notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
  dayOfMonth: integer("day_of_month"),
  monthOfYear: integer("month_of_year"),
  weekday: integer("weekday"),
  startOn: text("start_on").notNull(),
  endOn: text("end_on"),
  nextRunOn: text("next_run_on").notNull(),
  lastRunOn: text("last_run_on"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'expense' | 'income'
    amountMinor: integer("amount_minor").notNull(), // always positive
    categoryId: text("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    occurredOn: text("occurred_on").notNull(), // 'YYYY-MM-DD' local
    note: text("note"),
    recurringId: text("recurring_id").references(() => recurringRules.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("tx_user_month_idx").on(t.userId, t.occurredOn),
    // Guards lazy materialisation (P3) against duplicate inserts from
    // concurrent requests. NULLs are distinct in SQLite unique indexes, so
    // ordinary manual rows are unaffected.
    unique("tx_recurring_date_uq").on(t.recurringId, t.occurredOn),
  ],
);

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => financeCategories.id, {
    onDelete: "cascade",
  }), // NULL = overall monthly budget
  amountMinor: integer("amount_minor").notNull(),
  startMonth: text("start_month").notNull(), // 'YYYY-MM', inclusive
  endMonth: text("end_month"), // 'YYYY-MM', inclusive; NULL = still active
  createdAt: integer("created_at").notNull(),
});
```

- [ ] **Step 2: Add relations and types**

Append to the relations block:

```ts
export const financeCategoriesRelations = relations(
  financeCategories,
  ({ many }) => ({ transactions: many(transactions) }),
);

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(financeCategories, {
    fields: [transactions.categoryId],
    references: [financeCategories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
}));
```

And to the type exports at the bottom:

```ts
export type FinanceCategory = typeof financeCategories.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
```

- [ ] **Step 3: Generate and inspect the migration**

Run: `pnpm db:generate`
Expected: a new file in `src/db/migrations/` creating five tables plus the index and unique index. Open it and confirm no `DROP` statement touches an existing table.

- [ ] **Step 4: Apply the migration**

Run: `pnpm db:migrate`
Expected: applies cleanly. Verify with `pnpm db:studio` that `transactions`, `finance_categories`, `accounts`, `budgets` and `recurring_rules` exist.

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck
git add src/db/schema.ts src/db/migrations
git commit -m "feat(expenses): add expenses module tables"
```

---

### Task 4: In-memory database test harness

**Files:**
- Create: `src/server/services/__helpers__/test-db.ts`
- Modify: `vitest.config.ts` (no change expected — confirm `include` covers `src/**/*.test.ts`)

**Interfaces:**
- Consumes: `@libsql/client`, `drizzle-orm/libsql`, `drizzle-orm/libsql/migrator`, the schema from Task 3.
- Produces:
  - `setupTestDb(): Promise<{ db: LibSQLDatabase<typeof schema>; reset: () => Promise<void> }>`
  - `seedUser(db, id?: string): Promise<string>` — inserts a `user` row and returns its id.

> Services import the module singleton `db` from `@/db/client`, so tests mock that module with an in-memory libSQL instance. Without this, the ownership guards — the security-relevant part of this module — ship untested.

- [ ] **Step 1: Write the harness**

Create `src/server/services/__helpers__/test-db.ts`:

```ts
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";

export type TestDb = LibSQLDatabase<typeof schema>;

/**
 * A throwaway in-memory database with the real migrations applied. Services
 * import the `db` singleton, so a test file mocks `@/db/client` to return the
 * instance this creates:
 *
 *   const { db } = await setupTestDb();
 *   vi.mock("@/db/client", () => ({ db: testDb }));
 */
export async function setupTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return db;
}

/** Insert a user so foreign keys resolve; returns the user id. */
export async function seedUser(db: TestDb, id = "user-1"): Promise<string> {
  const now = new Date();
  await db.insert(schema.user).values({
    id,
    name: `Test ${id}`,
    email: `${id}@example.test`,
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
```

- [ ] **Step 2: Write a smoke test proving the harness works**

Create `src/server/services/__helpers__/test-db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import { seedUser, setupTestDb } from "./test-db";

describe("test-db harness", () => {
  it("applies migrations and accepts a user row", async () => {
    const db = await setupTestDb();
    const userId = await seedUser(db);

    const rows = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId));

    expect(rows).toHaveLength(1);
  });

  it("creates the expenses tables", async () => {
    const db = await setupTestDb();
    await expect(db.select().from(schema.transactions)).resolves.toEqual([]);
    await expect(db.select().from(schema.financeCategories)).resolves.toEqual([]);
    await expect(db.select().from(schema.accounts)).resolves.toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm vitest run src/server/services/__helpers__/test-db.test.ts`
Expected: PASS. If migration resolution fails, the `migrationsFolder` path is relative to the repo root — confirm `src/db/migrations/meta/_journal.json` exists.

- [ ] **Step 4: Commit**

```bash
pnpm lint && pnpm typecheck
git add src/server/services/__helpers__
git commit -m "test: add in-memory libsql harness for service tests"
```

---

### Task 5: Finance categories — validation, service, seeding

**Files:**
- Create: `src/lib/validations/finance-category.ts`
- Create: `src/server/services/finance-category.service.ts`
- Test: `src/server/services/finance-category.service.test.ts`

**Interfaces:**
- Consumes: `AppError` from `@/lib/api`; `epochNow`, `newId` from `@/lib/utils`; `TransactionType` from `@/lib/expenses`.
- Produces:
  - `createFinanceCategorySchema`, `updateFinanceCategorySchema` and their inferred input types
  - `listFinanceCategories(userId: string): Promise<FinanceCategory[]>` — seeds defaults on first call
  - `createFinanceCategory(userId, input): Promise<FinanceCategory>`
  - `updateFinanceCategory(userId, id, input): Promise<FinanceCategory>`
  - `archiveFinanceCategory(userId, id): Promise<void>`
  - `assertCategoryOwned(userId, categoryId): Promise<void>`

- [ ] **Step 1: Write the validation schema**

Create `src/lib/validations/finance-category.ts`:

```ts
import { z } from "zod";

export const CATEGORY_KINDS = ["expense", "income"] as const;
export const CATEGORY_COLORS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

export const createFinanceCategorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name.").max(40),
  kind: z.enum(CATEGORY_KINDS),
  color: z.enum(CATEGORY_COLORS).optional().nullable(),
  icon: z.string().trim().max(4).optional().nullable(),
});

export const updateFinanceCategorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name.").max(40).optional(),
  color: z.enum(CATEGORY_COLORS).optional().nullable(),
  icon: z.string().trim().max(4).optional().nullable(),
  isArchived: z.boolean().optional(),
});

export type CreateFinanceCategoryInput = z.infer<
  typeof createFinanceCategorySchema
>;
export type UpdateFinanceCategoryInput = z.infer<
  typeof updateFinanceCategorySchema
>;
```

- [ ] **Step 2: Write the failing test**

Create `src/server/services/finance-category.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDb, type TestDb } from "./__helpers__/test-db";

let db: TestDb;

vi.mock("@/db/client", () => ({
  get db() {
    return db;
  },
}));

const {
  archiveFinanceCategory,
  assertCategoryOwned,
  createFinanceCategory,
  listFinanceCategories,
  updateFinanceCategory,
} = await import("./finance-category.service");

describe("finance categories", () => {
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    userId = await seedUser(db);
  });

  it("seeds defaults on the first read", async () => {
    const list = await listFinanceCategories(userId);
    const names = list.map((c) => c.name);

    expect(names).toContain("Food & drink");
    expect(names).toContain("Salary");
    expect(list.filter((c) => c.kind === "expense").length).toBeGreaterThan(4);
    expect(list.filter((c) => c.kind === "income").length).toBeGreaterThan(0);
  });

  it("seeds only once", async () => {
    const first = await listFinanceCategories(userId);
    const second = await listFinanceCategories(userId);
    expect(second).toHaveLength(first.length);
  });

  it("does not seed one user's defaults into another", async () => {
    await listFinanceCategories(userId);
    const other = await seedUser(db, "user-2");
    const otherList = await listFinanceCategories(other);
    expect(otherList.every((c) => c.userId === other)).toBe(true);
  });

  it("creates a category at the end of its kind's order", async () => {
    await listFinanceCategories(userId);
    const created = await createFinanceCategory(userId, {
      name: "Kopi",
      kind: "expense",
      color: "chart-3",
      icon: "☕",
    });
    expect(created.name).toBe("Kopi");
    expect(created.userId).toBe(userId);
    expect(created.isArchived).toBe(0);
  });

  it("renames a category", async () => {
    const [first] = await listFinanceCategories(userId);
    const updated = await updateFinanceCategory(userId, first.id, {
      name: "Makan",
    });
    expect(updated.name).toBe("Makan");
  });

  it("refuses to update another user's category", async () => {
    const [first] = await listFinanceCategories(userId);
    const other = await seedUser(db, "user-2");
    await expect(
      updateFinanceCategory(other, first.id, { name: "Stolen" }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("archives instead of deleting", async () => {
    const [first] = await listFinanceCategories(userId);
    await archiveFinanceCategory(userId, first.id);
    const list = await listFinanceCategories(userId);
    expect(list.find((c) => c.id === first.id)).toBeUndefined();
  });

  it("asserts ownership", async () => {
    const [first] = await listFinanceCategories(userId);
    await expect(assertCategoryOwned(userId, first.id)).resolves.toBeUndefined();

    const other = await seedUser(db, "user-2");
    await expect(assertCategoryOwned(other, first.id)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/server/services/finance-category.service.test.ts`
Expected: FAIL — cannot resolve `./finance-category.service`.

- [ ] **Step 4: Write the service**

Create `src/server/services/finance-category.service.ts`:

```ts
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { financeCategories, type FinanceCategory } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateFinanceCategoryInput,
  UpdateFinanceCategoryInput,
} from "@/lib/validations/finance-category";

/**
 * Seeded on first use. Without defaults, logging the very first expense costs
 * the user a setup detour and the module's whole premise — fast entry — fails
 * on day one. Everything here is renameable and archivable.
 */
const DEFAULTS: Array<
  Pick<FinanceCategory, "name" | "kind" | "color" | "icon">
> = [
  { name: "Food & drink", kind: "expense", color: "chart-3", icon: "🍽" },
  { name: "Transport", kind: "expense", color: "chart-1", icon: "🛵" },
  { name: "Groceries", kind: "expense", color: "chart-2", icon: "🛒" },
  { name: "Bills", kind: "expense", color: "chart-4", icon: "🧾" },
  { name: "Shopping", kind: "expense", color: "chart-5", icon: "🛍" },
  { name: "Health", kind: "expense", color: "chart-2", icon: "💊" },
  { name: "Entertainment", kind: "expense", color: "chart-1", icon: "🎬" },
  { name: "Other", kind: "expense", color: "chart-5", icon: "📦" },
  { name: "Salary", kind: "income", color: "chart-2", icon: "💼" },
  { name: "Other income", kind: "income", color: "chart-2", icon: "💰" },
];

async function seedDefaults(userId: string): Promise<void> {
  const now = epochNow();
  await db.insert(financeCategories).values(
    DEFAULTS.map((d, i) => ({
      id: newId(),
      userId,
      name: d.name,
      kind: d.kind,
      color: d.color,
      icon: d.icon,
      sortOrder: i,
      isArchived: 0,
      createdAt: now,
    })),
  );
}

/**
 * List a user's active categories, seeding the defaults the first time. The
 * empty result is itself the "never used this module" signal, so steady-state
 * reads cost no extra query.
 */
export async function listFinanceCategories(
  userId: string,
): Promise<FinanceCategory[]> {
  const read = () =>
    db
      .select()
      .from(financeCategories)
      .where(
        and(
          eq(financeCategories.userId, userId),
          eq(financeCategories.isArchived, 0),
        ),
      )
      .orderBy(asc(financeCategories.sortOrder), asc(financeCategories.createdAt));

  const existing = await read();
  if (existing.length > 0) return existing;

  // Check for archived-only before seeding, or archiving everything would
  // resurrect the defaults on the next read.
  const any = await db
    .select({ id: financeCategories.id })
    .from(financeCategories)
    .where(eq(financeCategories.userId, userId))
    .limit(1);
  if (any.length > 0) return existing;

  await seedDefaults(userId);
  return read();
}

/**
 * Guard: a categoryId supplied by the client must belong to the same user.
 * The FK only proves the row exists — without this a request could attach
 * transactions to another user's category.
 */
export async function assertCategoryOwned(
  userId: string,
  categoryId: string,
): Promise<void> {
  const owned = await db
    .select({ id: financeCategories.id })
    .from(financeCategories)
    .where(
      and(
        eq(financeCategories.id, categoryId),
        eq(financeCategories.userId, userId),
      ),
    );

  if (owned.length === 0) {
    throw new AppError("NOT_FOUND", "That category no longer exists.");
  }
}

export async function createFinanceCategory(
  userId: string,
  input: CreateFinanceCategoryInput,
): Promise<FinanceCategory> {
  const siblings = await db
    .select({ sortOrder: financeCategories.sortOrder })
    .from(financeCategories)
    .where(eq(financeCategories.userId, userId));

  const maxOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  const row: FinanceCategory = {
    id: newId(),
    userId,
    name: input.name,
    kind: input.kind,
    color: input.color ?? null,
    icon: input.icon ?? null,
    sortOrder: maxOrder + 1,
    isArchived: 0,
    createdAt: epochNow(),
  };

  await db.insert(financeCategories).values(row);
  return row;
}

export async function updateFinanceCategory(
  userId: string,
  id: string,
  input: UpdateFinanceCategoryInput,
): Promise<FinanceCategory> {
  const patch: Partial<FinanceCategory> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.icon !== undefined) patch.icon = input.icon ?? null;
  if (input.isArchived !== undefined)
    patch.isArchived = input.isArchived ? 1 : 0;

  const updated = await db
    .update(financeCategories)
    .set(patch)
    .where(
      and(eq(financeCategories.id, id), eq(financeCategories.userId, userId)),
    )
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That category no longer exists.");
  }
  return updated[0];
}

/**
 * Archive, never delete: past transactions keep their category name. The
 * schema's `onDelete: "set null"` is the fallback for a real deletion.
 */
export async function archiveFinanceCategory(
  userId: string,
  id: string,
): Promise<void> {
  await updateFinanceCategory(userId, id, { isArchived: true });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/server/services/finance-category.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/lib/validations/finance-category.ts src/server/services/finance-category.service.ts src/server/services/finance-category.service.test.ts
git commit -m "feat(expenses): add finance categories service with seeded defaults"
```

---

### Task 6: Accounts — validation and service

**Files:**
- Create: `src/lib/validations/account.ts`
- Create: `src/server/services/account.service.ts`
- Test: `src/server/services/account.service.test.ts`

**Interfaces:**
- Consumes: same helpers as Task 5.
- Produces:
  - `createAccountSchema`, `updateAccountSchema`, `CreateAccountInput`, `UpdateAccountInput`
  - `listAccounts(userId): Promise<Account[]>` — seeds defaults on first call
  - `createAccount(userId, input): Promise<Account>`
  - `updateAccount(userId, id, input): Promise<Account>`
  - `archiveAccount(userId, id): Promise<void>`
  - `assertAccountOwned(userId, accountId): Promise<void>`

- [ ] **Step 1: Write the validation schema**

Create `src/lib/validations/account.ts`:

```ts
import { z } from "zod";

export const ACCOUNT_TYPES = ["cash", "bank", "ewallet", "card"] as const;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name.").max(40),
  type: z.enum(ACCOUNT_TYPES),
  color: z.string().trim().max(20).optional().nullable(),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name.").max(40).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  color: z.string().trim().max(20).optional().nullable(),
  isArchived: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
```

- [ ] **Step 2: Write the failing test**

Create `src/server/services/account.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDb, type TestDb } from "./__helpers__/test-db";

let db: TestDb;

vi.mock("@/db/client", () => ({
  get db() {
    return db;
  },
}));

const {
  archiveAccount,
  assertAccountOwned,
  createAccount,
  listAccounts,
  updateAccount,
} = await import("./account.service");

describe("accounts", () => {
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    userId = await seedUser(db);
  });

  it("seeds Cash, Bank and E-wallet on the first read", async () => {
    const list = await listAccounts(userId);
    expect(list.map((a) => a.name)).toEqual(["Cash", "Bank", "E-wallet"]);
  });

  it("seeds only once", async () => {
    const first = await listAccounts(userId);
    const second = await listAccounts(userId);
    expect(second).toHaveLength(first.length);
  });

  it("creates an account", async () => {
    await listAccounts(userId);
    const created = await createAccount(userId, { name: "GoPay", type: "ewallet" });
    expect(created.name).toBe("GoPay");
    expect(created.type).toBe("ewallet");
  });

  it("refuses to update another user's account", async () => {
    const [first] = await listAccounts(userId);
    const other = await seedUser(db, "user-2");
    await expect(
      updateAccount(other, first.id, { name: "Stolen" }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("archives instead of deleting", async () => {
    const [first] = await listAccounts(userId);
    await archiveAccount(userId, first.id);
    const list = await listAccounts(userId);
    expect(list.find((a) => a.id === first.id)).toBeUndefined();
  });

  it("asserts ownership", async () => {
    const [first] = await listAccounts(userId);
    await expect(assertAccountOwned(userId, first.id)).resolves.toBeUndefined();
    const other = await seedUser(db, "user-2");
    await expect(assertAccountOwned(other, first.id)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/server/services/account.service.test.ts`
Expected: FAIL — cannot resolve `./account.service`.

- [ ] **Step 4: Write the service**

Create `src/server/services/account.service.ts`:

```ts
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { accounts, type Account } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "@/lib/validations/account";

const DEFAULTS: Array<Pick<Account, "name" | "type">> = [
  { name: "Cash", type: "cash" },
  { name: "Bank", type: "bank" },
  { name: "E-wallet", type: "ewallet" },
];

async function seedDefaults(userId: string): Promise<void> {
  const now = epochNow();
  await db.insert(accounts).values(
    DEFAULTS.map((d, i) => ({
      id: newId(),
      userId,
      name: d.name,
      type: d.type,
      color: null,
      sortOrder: i,
      isArchived: 0,
      createdAt: now,
    })),
  );
}

export async function listAccounts(userId: string): Promise<Account[]> {
  const read = () =>
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, 0)))
      .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));

  const existing = await read();
  if (existing.length > 0) return existing;

  const any = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (any.length > 0) return existing;

  await seedDefaults(userId);
  return read();
}

/** Guard: an accountId from the client must belong to the same user. */
export async function assertAccountOwned(
  userId: string,
  accountId: string,
): Promise<void> {
  const owned = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  if (owned.length === 0) {
    throw new AppError("NOT_FOUND", "That account no longer exists.");
  }
}

export async function createAccount(
  userId: string,
  input: CreateAccountInput,
): Promise<Account> {
  const siblings = await db
    .select({ sortOrder: accounts.sortOrder })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const maxOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  const row: Account = {
    id: newId(),
    userId,
    name: input.name,
    type: input.type,
    color: input.color ?? null,
    sortOrder: maxOrder + 1,
    isArchived: 0,
    createdAt: epochNow(),
  };

  await db.insert(accounts).values(row);
  return row;
}

export async function updateAccount(
  userId: string,
  id: string,
  input: UpdateAccountInput,
): Promise<Account> {
  const patch: Partial<Account> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.isArchived !== undefined)
    patch.isArchived = input.isArchived ? 1 : 0;

  const updated = await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That account no longer exists.");
  }
  return updated[0];
}

export async function archiveAccount(
  userId: string,
  id: string,
): Promise<void> {
  await updateAccount(userId, id, { isArchived: true });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/server/services/account.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/lib/validations/account.ts src/server/services/account.service.ts src/server/services/account.service.test.ts
git commit -m "feat(expenses): add accounts service with seeded defaults"
```

---

### Task 7: Transactions service

**Files:**
- Create: `src/lib/validations/transaction.ts`
- Create: `src/server/services/transaction.service.ts`
- Test: `src/server/services/transaction.service.test.ts`

**Interfaces:**
- Consumes: `assertCategoryOwned` (Task 5), `assertAccountOwned` (Task 6), `buildLedger`/`monthBounds`/`MonthLedger` (Task 2), `MAX_AMOUNT_MINOR` (Task 1).
- Produces:
  - `createTransactionSchema`, `updateTransactionSchema`, `CreateTransactionInput`, `UpdateTransactionInput`
  - `type TransactionRow = Transaction & { category: CategoryRef | null; account: AccountRef | null }`
  - `type CategoryRef = { id: string; name: string; color: string | null; icon: string | null }`
  - `type AccountRef = { id: string; name: string; type: string }`
  - `listMonth(userId, month, filters?): Promise<MonthLedger<TransactionRow>>`
  - `createTransaction(userId, input): Promise<TransactionRow>`
  - `updateTransaction(userId, id, input): Promise<TransactionRow>`
  - `deleteTransaction(userId, id): Promise<void>`

- [ ] **Step 1: Write the validation schema**

Create `src/lib/validations/transaction.ts`:

```ts
import { z } from "zod";
import { MAX_AMOUNT_MINOR } from "@/lib/money";

export const TRANSACTION_TYPES = ["expense", "income"] as const;

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");

export const createTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amountMinor: z
    .number()
    .int("Enter a whole amount.")
    .positive("Enter an amount.")
    .max(MAX_AMOUNT_MINOR, "That amount is too large."),
  categoryId: z.string().min(1).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  occurredOn: localDate,
  note: z.string().trim().max(200).optional().nullable(),
});

export const updateTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES).optional(),
  amountMinor: z
    .number()
    .int("Enter a whole amount.")
    .positive("Enter an amount.")
    .max(MAX_AMOUNT_MINOR, "That amount is too large.")
    .optional(),
  categoryId: z.string().min(1).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  occurredOn: localDate.optional(),
  note: z.string().trim().max(200).optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
```

- [ ] **Step 2: Write the failing test**

Create `src/server/services/transaction.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDb, type TestDb } from "./__helpers__/test-db";

let db: TestDb;

vi.mock("@/db/client", () => ({
  get db() {
    return db;
  },
}));

const { listAccounts } = await import("./account.service");
const { listFinanceCategories } = await import("./finance-category.service");
const {
  createTransaction,
  deleteTransaction,
  listMonth,
  updateTransaction,
} = await import("./transaction.service");

describe("transactions", () => {
  let userId: string;
  let categoryId: string;
  let accountId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    userId = await seedUser(db);
    categoryId = (await listFinanceCategories(userId))[0].id;
    accountId = (await listAccounts(userId))[0].id;
  });

  const expense = (occurredOn: string, amountMinor: number) => ({
    type: "expense" as const,
    amountMinor,
    categoryId,
    accountId,
    occurredOn,
    note: null,
  });

  it("creates a transaction with its category and account attached", async () => {
    const created = await createTransaction(userId, expense("2026-07-27", 25000));
    expect(created.amountMinor).toBe(25000);
    expect(created.category?.id).toBe(categoryId);
    expect(created.account?.id).toBe(accountId);
    expect(created.recurringId).toBeNull();
  });

  it("lists a month grouped by day with totals", async () => {
    await createTransaction(userId, expense("2026-07-27", 25000));
    await createTransaction(userId, expense("2026-07-25", 100000));
    await createTransaction(userId, {
      ...expense("2026-07-26", 2500000),
      type: "income",
    });

    const ledger = await listMonth(userId, "2026-07");

    expect(ledger.days.map((d) => d.date)).toEqual([
      "2026-07-27",
      "2026-07-26",
      "2026-07-25",
    ]);
    expect(ledger.totals).toEqual({
      expenseMinor: 125000,
      incomeMinor: 2500000,
      netMinor: 2375000,
    });
  });

  it("excludes other months", async () => {
    await createTransaction(userId, expense("2026-07-31", 1000));
    await createTransaction(userId, expense("2026-08-01", 9999));
    const ledger = await listMonth(userId, "2026-07");
    expect(ledger.totals.expenseMinor).toBe(1000);
  });

  it("excludes other users' rows", async () => {
    await createTransaction(userId, expense("2026-07-27", 25000));
    const other = await seedUser(db, "user-2");
    const ledger = await listMonth(other, "2026-07");
    expect(ledger.days).toEqual([]);
    expect(ledger.totals.expenseMinor).toBe(0);
  });

  it("filters by type, category and account", async () => {
    await createTransaction(userId, expense("2026-07-27", 25000));
    await createTransaction(userId, {
      ...expense("2026-07-27", 2500000),
      type: "income",
    });

    const onlyExpense = await listMonth(userId, "2026-07", { type: "expense" });
    expect(onlyExpense.totals.incomeMinor).toBe(0);

    const byCategory = await listMonth(userId, "2026-07", { categoryId });
    expect(byCategory.totals.expenseMinor).toBe(25000);

    const byAccount = await listMonth(userId, "2026-07", { accountId });
    expect(byAccount.days[0].items).toHaveLength(2);
  });

  it("searches notes", async () => {
    await createTransaction(userId, {
      ...expense("2026-07-27", 25000),
      note: "Kopi Tuku",
    });
    await createTransaction(userId, expense("2026-07-27", 70000));

    const found = await listMonth(userId, "2026-07", { q: "kopi" });
    expect(found.days[0].items).toHaveLength(1);
  });

  it("rejects a category belonging to another user", async () => {
    const other = await seedUser(db, "user-2");
    const foreign = (await listFinanceCategories(other))[0].id;
    await expect(
      createTransaction(userId, { ...expense("2026-07-27", 1000), categoryId: foreign }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("rejects an account belonging to another user", async () => {
    const other = await seedUser(db, "user-2");
    const foreign = (await listAccounts(other))[0].id;
    await expect(
      createTransaction(userId, { ...expense("2026-07-27", 1000), accountId: foreign }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("updates a transaction and bumps updatedAt", async () => {
    const created = await createTransaction(userId, expense("2026-07-27", 25000));
    const updated = await updateTransaction(userId, created.id, {
      amountMinor: 30000,
      note: "Kopi",
    });
    expect(updated.amountMinor).toBe(30000);
    expect(updated.note).toBe("Kopi");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it("clears a category by passing null", async () => {
    const created = await createTransaction(userId, expense("2026-07-27", 25000));
    const updated = await updateTransaction(userId, created.id, {
      categoryId: null,
    });
    expect(updated.categoryId).toBeNull();
    expect(updated.category).toBeNull();
  });

  it("refuses to update another user's transaction", async () => {
    const created = await createTransaction(userId, expense("2026-07-27", 25000));
    const other = await seedUser(db, "user-2");
    await expect(
      updateTransaction(other, created.id, { amountMinor: 1 }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("deletes a transaction", async () => {
    const created = await createTransaction(userId, expense("2026-07-27", 25000));
    await deleteTransaction(userId, created.id);
    const ledger = await listMonth(userId, "2026-07");
    expect(ledger.days).toEqual([]);
  });

  it("refuses to delete another user's transaction", async () => {
    const created = await createTransaction(userId, expense("2026-07-27", 25000));
    const other = await seedUser(db, "user-2");
    await expect(deleteTransaction(other, created.id)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/server/services/transaction.service.test.ts`
Expected: FAIL — cannot resolve `./transaction.service`.

- [ ] **Step 4: Write the service**

Create `src/server/services/transaction.service.ts`:

```ts
import { and, desc, eq, gte, like, lte } from "drizzle-orm";

import { db } from "@/db/client";
import {
  accounts,
  financeCategories,
  transactions,
  type Transaction,
} from "@/db/schema";
import { AppError } from "@/lib/api";
import {
  buildLedger,
  monthBounds,
  type MonthKey,
  type MonthLedger,
  type TransactionType,
} from "@/lib/expenses";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/lib/validations/transaction";
import { assertAccountOwned } from "./account.service";
import { assertCategoryOwned } from "./finance-category.service";

export type CategoryRef = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
};

export type AccountRef = { id: string; name: string; type: string };

/** A transaction with the two labels the UI needs, resolved server-side. */
export type TransactionRow = Transaction & {
  category: CategoryRef | null;
  account: AccountRef | null;
};

export type MonthFilters = {
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  /** Case-insensitive substring match on the note. */
  q?: string;
};

const selection = {
  id: transactions.id,
  userId: transactions.userId,
  type: transactions.type,
  amountMinor: transactions.amountMinor,
  categoryId: transactions.categoryId,
  accountId: transactions.accountId,
  occurredOn: transactions.occurredOn,
  note: transactions.note,
  recurringId: transactions.recurringId,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
  categoryName: financeCategories.name,
  categoryColor: financeCategories.color,
  categoryIcon: financeCategories.icon,
  accountName: accounts.name,
  accountType: accounts.type,
};

function toRow(r: Record<string, unknown>): TransactionRow {
  return {
    id: r.id as string,
    userId: r.userId as string,
    type: r.type as string,
    amountMinor: r.amountMinor as number,
    categoryId: (r.categoryId as string | null) ?? null,
    accountId: (r.accountId as string | null) ?? null,
    occurredOn: r.occurredOn as string,
    note: (r.note as string | null) ?? null,
    recurringId: (r.recurringId as string | null) ?? null,
    createdAt: r.createdAt as number,
    updatedAt: r.updatedAt as number,
    category: r.categoryId
      ? {
          id: r.categoryId as string,
          name: r.categoryName as string,
          color: (r.categoryColor as string | null) ?? null,
          icon: (r.categoryIcon as string | null) ?? null,
        }
      : null,
    account: r.accountId
      ? {
          id: r.accountId as string,
          name: r.accountName as string,
          type: r.accountType as string,
        }
      : null,
  } as TransactionRow;
}

/**
 * One month of transactions, grouped by day with per-day and month totals.
 * Grouping and summing happen here — the client renders money, it never
 * aggregates it.
 */
export async function listMonth(
  userId: string,
  month: MonthKey,
  filters: MonthFilters = {},
): Promise<MonthLedger<TransactionRow>> {
  const { start, end } = monthBounds(month);

  const where = [
    eq(transactions.userId, userId),
    gte(transactions.occurredOn, start),
    lte(transactions.occurredOn, end),
  ];

  if (filters.type) where.push(eq(transactions.type, filters.type));
  if (filters.categoryId)
    where.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.accountId)
    where.push(eq(transactions.accountId, filters.accountId));
  if (filters.q) where.push(like(transactions.note, `%${filters.q}%`));

  const rows = await db
    .select(selection)
    .from(transactions)
    .leftJoin(
      financeCategories,
      eq(transactions.categoryId, financeCategories.id),
    )
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...where))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));

  return buildLedger(rows.map((r) => toRow(r as Record<string, unknown>)));
}

async function readOne(
  userId: string,
  id: string,
): Promise<TransactionRow> {
  const rows = await db
    .select(selection)
    .from(transactions)
    .leftJoin(
      financeCategories,
      eq(transactions.categoryId, financeCategories.id),
    )
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (rows.length === 0) {
    throw new AppError("NOT_FOUND", "That entry no longer exists.");
  }
  return toRow(rows[0] as Record<string, unknown>);
}

async function assertRefsOwned(
  userId: string,
  categoryId?: string | null,
  accountId?: string | null,
): Promise<void> {
  if (categoryId) await assertCategoryOwned(userId, categoryId);
  if (accountId) await assertAccountOwned(userId, accountId);
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionRow> {
  await assertRefsOwned(userId, input.categoryId, input.accountId);

  const now = epochNow();
  const id = newId();

  await db.insert(transactions).values({
    id,
    userId,
    type: input.type,
    amountMinor: input.amountMinor,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    occurredOn: input.occurredOn,
    note: input.note ?? null,
    recurringId: null,
    createdAt: now,
    updatedAt: now,
  });

  return readOne(userId, id);
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionRow> {
  await assertRefsOwned(userId, input.categoryId, input.accountId);

  const patch: Partial<Transaction> = { updatedAt: epochNow() };
  if (input.type !== undefined) patch.type = input.type;
  if (input.amountMinor !== undefined) patch.amountMinor = input.amountMinor;
  if (input.categoryId !== undefined)
    patch.categoryId = input.categoryId ?? null;
  if (input.accountId !== undefined) patch.accountId = input.accountId ?? null;
  if (input.occurredOn !== undefined) patch.occurredOn = input.occurredOn;
  if (input.note !== undefined) patch.note = input.note ?? null;

  const updated = await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That entry no longer exists.");
  }

  return readOne(userId, id);
}

export async function deleteTransaction(
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });

  if (deleted.length === 0) {
    throw new AppError("NOT_FOUND", "That entry no longer exists.");
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/server/services/transaction.service.test.ts`
Expected: PASS.

> The note search test uses `like` with a lowercase needle. SQLite's `LIKE` is case-insensitive for ASCII by default, so `"kopi"` matches `"Kopi Tuku"`. If it fails, wrap both sides in `lower()` via `sql` from drizzle-orm.

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/lib/validations/transaction.ts src/server/services/transaction.service.ts src/server/services/transaction.service.test.ts
git commit -m "feat(expenses): add transactions service with month ledger reads"
```

---

### Task 8: Route handlers

**Files:**
- Create: `src/app/api/finance-categories/route.ts`
- Create: `src/app/api/finance-categories/[id]/route.ts`
- Create: `src/app/api/accounts/route.ts`
- Create: `src/app/api/accounts/[id]/route.ts`
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/transactions/[id]/route.ts`

**Interfaces:**
- Consumes: services from Tasks 5–7; `handle`, `ok`, `readJson`, `validate` from `@/lib/api`; `requireUserId` from `@/lib/get-session`; `currentMonthKey`, `isValidMonthKey` from `@/lib/expenses`.
- Produces: the six endpoints. `GET /api/transactions?month=YYYY-MM&type=&categoryId=&accountId=&q=` returns `MonthLedger<TransactionRow>`.

> **Before writing these, read the route handler guide in `node_modules/next/dist/docs/`.** Match the existing shape in `src/app/api/todos/route.ts` — note that `params` is a Promise in this version.

- [ ] **Step 1: Write the finance-categories routes**

Create `src/app/api/finance-categories/route.ts`:

```ts
import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createFinanceCategorySchema } from "@/lib/validations/finance-category";
import {
  createFinanceCategory,
  listFinanceCategories,
} from "@/server/services/finance-category.service";

export function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    return ok(await listFinanceCategories(userId));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createFinanceCategorySchema, await readJson(req));
    return ok(await createFinanceCategory(userId, input), { status: 201 });
  });
}
```

Create `src/app/api/finance-categories/[id]/route.ts`:

```ts
import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateFinanceCategorySchema } from "@/lib/validations/finance-category";
import {
  archiveFinanceCategory,
  updateFinanceCategory,
} from "@/server/services/finance-category.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateFinanceCategorySchema, await readJson(req));
    return ok(await updateFinanceCategory(userId, id, input));
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await archiveFinanceCategory(userId, id);
    return ok({ id });
  });
}
```

- [ ] **Step 2: Write the accounts routes**

Create `src/app/api/accounts/route.ts`:

```ts
import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { createAccountSchema } from "@/lib/validations/account";
import { createAccount, listAccounts } from "@/server/services/account.service";

export function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    return ok(await listAccounts(userId));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createAccountSchema, await readJson(req));
    return ok(await createAccount(userId, input), { status: 201 });
  });
}
```

Create `src/app/api/accounts/[id]/route.ts`:

```ts
import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateAccountSchema } from "@/lib/validations/account";
import {
  archiveAccount,
  updateAccount,
} from "@/server/services/account.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateAccountSchema, await readJson(req));
    return ok(await updateAccount(userId, id, input));
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await archiveAccount(userId, id);
    return ok({ id });
  });
}
```

- [ ] **Step 3: Write the transactions routes**

Create `src/app/api/transactions/route.ts`:

```ts
import { AppError, handle, ok, readJson, validate } from "@/lib/api";
import { currentMonthKey, isValidMonthKey } from "@/lib/expenses";
import { requireUserId } from "@/lib/get-session";
import { createTransactionSchema } from "@/lib/validations/transaction";
import {
  createTransaction,
  listMonth,
  type MonthFilters,
} from "@/server/services/transaction.service";

export function GET(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);

    const month = searchParams.get("month") ?? currentMonthKey();
    if (!isValidMonthKey(month)) {
      throw new AppError("VALIDATION_ERROR", "Pick a valid month.");
    }

    const type = searchParams.get("type");
    const filters: MonthFilters = {
      type: type === "expense" || type === "income" ? type : undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      accountId: searchParams.get("accountId") ?? undefined,
      q: searchParams.get("q")?.trim() || undefined,
    };

    return ok(await listMonth(userId, month, filters));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const input = validate(createTransactionSchema, await readJson(req));
    return ok(await createTransaction(userId, input), { status: 201 });
  });
}
```

Create `src/app/api/transactions/[id]/route.ts`:

```ts
import { handle, ok, readJson, validate } from "@/lib/api";
import { requireUserId } from "@/lib/get-session";
import { updateTransactionSchema } from "@/lib/validations/transaction";
import {
  deleteTransaction,
  updateTransaction,
} from "@/server/services/transaction.service";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = validate(updateTransactionSchema, await readJson(req));
    return ok(await updateTransaction(userId, id, input));
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteTransaction(userId, id);
    return ok({ id });
  });
}
```

- [ ] **Step 4: Verify the endpoints against a running server**

Run `pnpm dev`, sign in through the browser, then in DevTools console:

```js
await (await fetch("/api/finance-categories")).json();
// → { data: [ …10 seeded categories… ], error: null }

await (await fetch("/api/transactions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "expense", amountMinor: 25000, occurredOn: "2026-07-27", note: "Kopi Tuku" }),
})).json();
// → { data: { id: …, amountMinor: 25000, … }, error: null }

await (await fetch("/api/transactions?month=2026-07")).json();
// → { data: { days: [ { date: "2026-07-27", expenseMinor: 25000, … } ], totals: {…} }, error: null }

await (await fetch("/api/transactions?month=nope")).json();
// → { data: null, error: { code: "VALIDATION_ERROR", message: "Pick a valid month." } }
```

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/app/api/finance-categories src/app/api/accounts src/app/api/transactions
git commit -m "feat(expenses): add finance categories, accounts and transactions endpoints"
```

---

### Task 9: Query hooks

**Files:**
- Create: `src/hooks/use-finance-categories.ts`
- Create: `src/hooks/use-accounts.ts`
- Create: `src/hooks/use-transactions.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/fetcher`; ledger helpers from `@/lib/expenses`; `TransactionRow` from `@/server/services/transaction.service` (type-only import, safe in client code).
- Produces:
  - `useFinanceCategories()`, `useCreateFinanceCategory()`
  - `useAccounts()`
  - `transactionsKey(month: string): readonly unknown[]`
  - `useTransactions(month: string)`, `useCreateTransaction(month)`, `useUpdateTransaction(month)`, `useDeleteTransaction(month)`

- [ ] **Step 1: Write the categories and accounts hooks**

Create `src/hooks/use-finance-categories.ts`:

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FinanceCategory } from "@/db/schema";
import { apiFetch } from "@/lib/fetcher";
import type { CreateFinanceCategoryInput } from "@/lib/validations/finance-category";

const KEY = ["finance-categories"] as const;

export function useFinanceCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<FinanceCategory[]>("/api/finance-categories"),
  });
}

export function useCreateFinanceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFinanceCategoryInput) =>
      apiFetch<FinanceCategory>("/api/finance-categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

Create `src/hooks/use-accounts.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import type { Account } from "@/db/schema";
import { apiFetch } from "@/lib/fetcher";

const KEY = ["accounts"] as const;

export function useAccounts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<Account[]>("/api/accounts"),
  });
}
```

- [ ] **Step 2: Write the transactions hooks**

Create `src/hooks/use-transactions.ts`:

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ledgerInsert,
  ledgerRemove,
  ledgerReplace,
  type MonthLedger,
} from "@/lib/expenses";
import { apiFetch } from "@/lib/fetcher";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/lib/validations/transaction";
import type { TransactionRow } from "@/server/services/transaction.service";

export type Ledger = MonthLedger<TransactionRow>;

export function transactionsKey(month: string) {
  return ["transactions", month] as const;
}

const EMPTY: Ledger = {
  days: [],
  totals: { expenseMinor: 0, incomeMinor: 0, netMinor: 0 },
};

export function useTransactions(month: string) {
  return useQuery({
    queryKey: transactionsKey(month),
    queryFn: () =>
      apiFetch<Ledger>(`/api/transactions?month=${encodeURIComponent(month)}`),
  });
}

/**
 * Optimistic row for a create. The id is thrown away when the server responds;
 * category and account labels are filled in by the caller so the row renders
 * complete rather than flickering from "Uncategorized" to its real name.
 */
function optimisticRow(
  input: CreateTransactionInput,
  refs: Pick<TransactionRow, "category" | "account">,
): TransactionRow {
  const now = epochNow();
  return {
    id: newId(),
    userId: "",
    type: input.type,
    amountMinor: input.amountMinor,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    occurredOn: input.occurredOn,
    note: input.note ?? null,
    recurringId: null,
    createdAt: now,
    updatedAt: now,
    category: refs.category,
    account: refs.account,
  };
}

export function useCreateTransaction(month: string) {
  const qc = useQueryClient();
  const key = transactionsKey(month);

  return useMutation({
    mutationFn: (vars: {
      input: CreateTransactionInput;
      refs: Pick<TransactionRow, "category" | "account">;
    }) =>
      apiFetch<TransactionRow>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(vars.input),
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Ledger>(key) ?? EMPTY;
      qc.setQueryData<Ledger>(
        key,
        ledgerInsert(prev, optimisticRow(vars.input, vars.refs)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateTransaction(month: string) {
  const qc = useQueryClient();
  const key = transactionsKey(month);

  return useMutation({
    mutationFn: (vars: { id: string; patch: UpdateTransactionInput }) =>
      apiFetch<TransactionRow>(`/api/transactions/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify(vars.patch),
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Ledger>(key) ?? EMPTY;
      const current = prev.days
        .flatMap((d) => d.items)
        .find((r) => r.id === vars.id);
      if (current) {
        const next: TransactionRow = {
          ...current,
          type: vars.patch.type ?? current.type,
          amountMinor: vars.patch.amountMinor ?? current.amountMinor,
          occurredOn: vars.patch.occurredOn ?? current.occurredOn,
          note:
            vars.patch.note === undefined ? current.note : vars.patch.note ?? null,
          updatedAt: epochNow(),
        };
        qc.setQueryData<Ledger>(key, ledgerReplace(prev, vars.id, next));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteTransaction(month: string) {
  const qc = useQueryClient();
  const key = transactionsKey(month);

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/transactions/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Ledger>(key) ?? EMPTY;
      qc.setQueryData<Ledger>(key, ledgerRemove(prev, id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-finance-categories.ts src/hooks/use-accounts.ts src/hooks/use-transactions.ts
git commit -m "feat(expenses): add query hooks for categories, accounts and transactions"
```

---

### Task 10: Amount field and numpad

**Files:**
- Create: `src/stores/expense-sheet.ts`
- Create: `src/components/expenses/numpad.tsx`
- Create: `src/components/expenses/amount-field.tsx`

**Interfaces:**
- Consumes: `applyNumpadKey`, `formatMoneyCompact`, `parseAmountInput`, `CURRENCY` from `@/lib/money`; `TransactionType` from `@/lib/expenses`.
- Produces:
  - `useExpenseSheet()` — Zustand store with `inputMode: "numpad" | "keyboard"` and `setInputMode`, persisted to localStorage.
  - `<Numpad onKey={(k: NumpadKey) => void} onSave={() => void} saveDisabled={boolean} type={TransactionType} />`
  - `<AmountField digits={string} onDigitsChange={(d: string) => void} type={TransactionType} inputMode={"numpad"|"keyboard"} />`

- [ ] **Step 1: Write the persisted store**

Create `src/stores/expense-sheet.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * UI-only state for the add/edit sheet. The input mode is a genuine personal
 * preference — some people want the numpad, some want the system keyboard — so
 * it persists per device and the sheet reopens the way it was last used.
 *
 * As with the todo view store, consumers must gate the restored value behind
 * useIsMounted so the first client render matches the server default.
 */
type ExpenseSheetState = {
  inputMode: "numpad" | "keyboard";
  setInputMode: (mode: "numpad" | "keyboard") => void;
};

export const useExpenseSheet = create<ExpenseSheetState>()(
  persist(
    (set) => ({
      inputMode: "numpad",
      setInputMode: (inputMode) => set({ inputMode }),
    }),
    { name: "flow-expense-sheet" },
  ),
);
```

- [ ] **Step 2: Write the numpad**

Create `src/components/expenses/numpad.tsx`:

```tsx
"use client";

import { Delete } from "lucide-react";

import type { TransactionType } from "@/lib/expenses";
import type { NumpadKey } from "@/lib/money";
import { cn } from "@/lib/utils";

const DIGIT_KEYS: NumpadKey[] = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];

/**
 * The in-sheet keypad. Save spans two rows on the right — the largest and most
 * thumb-reachable target on the screen. `000` exists because rupiah amounts are
 * thousands: 25.000 is four taps.
 */
export function Numpad({
  onKey,
  onSave,
  saveDisabled,
  type,
}: {
  onKey: (key: NumpadKey) => void;
  onSave: () => void;
  saveDisabled: boolean;
  type: TransactionType;
}) {
  const keyClass =
    "h-14 rounded-lg border bg-card text-xl font-medium tabular-nums " +
    "transition-colors active:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="grid grid-cols-4 gap-1.5 p-2">
      {DIGIT_KEYS.slice(0, 3).map((k) => (
        <button key={k} type="button" className={keyClass} onClick={() => onKey(k)}>
          {k}
        </button>
      ))}

      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className={cn(
          "row-span-2 rounded-lg text-base font-semibold text-white transition-opacity",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          type === "income" ? "bg-success" : "bg-primary",
          saveDisabled && "opacity-45",
        )}
      >
        Save
      </button>

      {DIGIT_KEYS.slice(3).map((k) => (
        <button key={k} type="button" className={keyClass} onClick={() => onKey(k)}>
          {k}
        </button>
      ))}

      <button
        type="button"
        className={keyClass}
        onClick={() => onKey("del")}
        aria-label="Delete last digit"
      >
        <Delete className="mx-auto size-5" />
      </button>
      <button type="button" className={keyClass} onClick={() => onKey("0")}>
        0
      </button>
      <button
        type="button"
        className={cn(keyClass, "text-base")}
        onClick={() => onKey("000")}
      >
        000
      </button>
      <button
        type="button"
        className={cn(keyClass, "text-base")}
        onClick={() => onKey("clear")}
        aria-label="Clear amount"
      >
        C
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Write the amount field**

Create `src/components/expenses/amount-field.tsx`:

```tsx
"use client";

import type { TransactionType } from "@/lib/expenses";
import { CURRENCY, formatMoneyCompact, parseAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The amount is a real input in both modes — never a display-only element
 * wrapped around a custom widget. That keeps paste, dictation, hardware
 * keyboards and the system numeric keypad working, and means the numpad is an
 * affordance rather than the only path.
 *
 * `readOnly` in numpad mode stops the OS keyboard from covering the pad while
 * still allowing focus, selection and copy.
 */
export function AmountField({
  digits,
  onDigitsChange,
  type,
  inputMode,
}: {
  digits: string;
  onDigitsChange: (digits: string) => void;
  type: TransactionType;
  inputMode: "numpad" | "keyboard";
}) {
  const value = digits === "" ? "" : formatMoneyCompact(Number(digits));

  return (
    <div className="flex flex-col gap-1 px-5 pt-2 pb-3">
      <label
        htmlFor="expense-amount"
        className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase"
      >
        {type === "income" ? "Amount received" : "Amount"}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xl font-semibold">
          {CURRENCY.symbol}
        </span>
        <input
          id="expense-amount"
          inputMode="decimal"
          autoComplete="off"
          readOnly={inputMode === "numpad"}
          value={value}
          placeholder="0"
          onChange={(e) =>
            onDigitsChange(String(parseAmountInput(e.target.value) || ""))
          }
          className={cn(
            "w-full min-w-0 border-0 bg-transparent p-0 text-[40px] leading-tight font-bold tracking-tight tabular-nums",
            "placeholder:text-muted-foreground focus:outline-none",
            type === "income" && digits !== "" && "text-success",
          )}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/stores/expense-sheet.ts src/components/expenses/numpad.tsx src/components/expenses/amount-field.tsx
git commit -m "feat(expenses): add amount field and numpad with persisted input mode"
```

---

### Task 11: Transaction sheet

**Files:**
- Create: `src/components/expenses/category-chips.tsx`
- Create: `src/components/expenses/transaction-sheet.tsx`

**Interfaces:**
- Consumes: `AmountField`, `Numpad`, `useExpenseSheet` (Task 10); hooks from Task 9; `ResponsiveModal` from `@/components/ui/responsive-modal`; `getLocalToday` from `@/lib/utils`.
- Produces:
  - `<CategoryChips categories={FinanceCategory[]} value={string | null} onChange={(id: string | null) => void} />`
  - `<TransactionSheet open onOpenChange month editing={TransactionRow | null} />`

- [ ] **Step 1: Write the category chips**

Create `src/components/expenses/category-chips.tsx`:

```tsx
"use client";

import type { FinanceCategory } from "@/db/schema";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

/**
 * Toggle chips, not a dropdown: picking a category must not cost a second
 * screen. Tapping the selected chip clears it — uncategorized is legitimate.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: FinanceCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Category"
    >
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : c.id)}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "bg-card hover:bg-muted",
            )}
          >
            {c.icon ? (
              <span aria-hidden>{c.icon}</span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  DOT[c.color ?? ""] ?? "bg-muted-foreground",
                )}
              />
            )}
            <span className="max-w-32 truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write the sheet**

Create `src/components/expenses/transaction-sheet.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Calculator, Keyboard } from "lucide-react";
import { toast } from "sonner";

import { useAccounts } from "@/hooks/use-accounts";
import { useFinanceCategories } from "@/hooks/use-finance-categories";
import { useIsMounted } from "@/hooks/use-is-mounted";
import {
  useCreateTransaction,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import type { TransactionType } from "@/lib/expenses";
import { applyNumpadKey, type NumpadKey } from "@/lib/money";
import { cn, getLocalToday } from "@/lib/utils";
import { useExpenseSheet } from "@/stores/expense-sheet";
import type { TransactionRow } from "@/server/services/transaction.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { AmountField } from "./amount-field";
import { CategoryChips } from "./category-chips";
import { Numpad } from "./numpad";

export function TransactionSheet({
  open,
  onOpenChange,
  month,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  editing: TransactionRow | null;
}) {
  const { data: categories = [] } = useFinanceCategories();
  const { data: accounts = [] } = useAccounts();
  const create = useCreateTransaction(month);
  const update = useUpdateTransaction(month);

  const mounted = useIsMounted();
  const storedMode = useExpenseSheet((s) => s.inputMode);
  const setInputMode = useExpenseSheet((s) => s.setInputMode);
  const inputMode = mounted ? storedMode : "numpad";

  const [type, setType] = useState<TransactionType>("expense");
  const [digits, setDigits] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [occurredOn, setOccurredOn] = useState(getLocalToday());
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  // Reset (or prefill) every time the sheet opens, so a cancelled entry never
  // leaks into the next one.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type as TransactionType);
      setDigits(String(editing.amountMinor));
      setCategoryId(editing.categoryId);
      setAccountId(editing.accountId);
      setOccurredOn(editing.occurredOn);
      setNote(editing.note ?? "");
      setShowNote(Boolean(editing.note));
    } else {
      setType("expense");
      setDigits("");
      setCategoryId(null);
      setAccountId(accounts[0]?.id ?? null);
      setOccurredOn(getLocalToday());
      setNote("");
      setShowNote(false);
    }
  }, [open, editing, accounts]);

  const amountMinor = digits === "" ? 0 : Number(digits);
  const canSave = amountMinor > 0;
  const visibleCategories = categories.filter((c) => c.kind === type);

  function handleKey(key: NumpadKey) {
    setDigits((d) => applyNumpadKey(d, key));
  }

  function submit() {
    if (!canSave) return;

    const payload = {
      type,
      amountMinor,
      categoryId,
      accountId,
      occurredOn,
      note: note.trim() || null,
    };

    if (editing) {
      update.mutate(
        { id: editing.id, patch: payload },
        { onError: (e) => toast.error(e.message) },
      );
      toast.success("Entry updated");
    } else {
      const refs = {
        category:
          categories.find((c) => c.id === categoryId) == null
            ? null
            : {
                id: categoryId as string,
                name: categories.find((c) => c.id === categoryId)!.name,
                color: categories.find((c) => c.id === categoryId)!.color,
                icon: categories.find((c) => c.id === categoryId)!.icon,
              },
        account:
          accounts.find((a) => a.id === accountId) == null
            ? null
            : {
                id: accountId as string,
                name: accounts.find((a) => a.id === accountId)!.name,
                type: accounts.find((a) => a.id === accountId)!.type,
              },
      };
      create.mutate(
        { input: payload, refs },
        { onError: (e) => toast.error(e.message) },
      );
      toast.success(type === "income" ? "Income added" : "Expense added");
    }

    onOpenChange(false);
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit entry" : "Add entry"}
    >
      <div className="flex flex-col">
        {/* type switch + input mode toggle */}
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <div className="bg-muted flex gap-1 rounded-full p-1">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => {
                  setType(t);
                  setCategoryId(null);
                }}
                className={cn(
                  "min-h-9 rounded-full px-4 text-sm font-semibold capitalize transition-colors",
                  type === t
                    ? t === "income"
                      ? "bg-card text-success shadow-sm"
                      : "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setInputMode(inputMode === "numpad" ? "keyboard" : "numpad")
            }
          >
            {inputMode === "numpad" ? (
              <>
                <Keyboard className="size-4" /> Keyboard
              </>
            ) : (
              <>
                <Calculator className="size-4" /> Numpad
              </>
            )}
          </Button>
        </div>

        <AmountField
          digits={digits}
          onDigitsChange={setDigits}
          type={type}
          inputMode={inputMode}
        />

        <CategoryChips
          categories={visibleCategories}
          value={categoryId}
          onChange={setCategoryId}
        />

        {/* account + date + note toggles */}
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={a.id === accountId}
              onClick={() => setAccountId(a.id)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm transition-colors",
                a.id === accountId
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a.name}
            </button>
          ))}

          <label className="sr-only" htmlFor="expense-date">
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value || getLocalToday())}
            className="bg-card min-h-11 rounded-full border px-3 text-sm"
          />

          {!showNote ? (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="text-muted-foreground hover:text-foreground min-h-11 rounded-full border border-dashed px-3 text-sm"
            >
              + Note
            </button>
          ) : null}
        </div>

        {showNote ? (
          <div className="px-4 pb-3">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was it for?"
              aria-label="Note"
              maxLength={200}
              className="h-11"
              autoFocus
            />
          </div>
        ) : null}

        {/* In keyboard mode Save moves above the system keyboard, which would
            otherwise cover it — the classic quick-add failure on mobile. */}
        {inputMode === "keyboard" ? (
          <div className="px-4 pb-2">
            <Button
              type="button"
              onClick={submit}
              disabled={!canSave}
              className={cn(
                "h-12 w-full text-base",
                type === "income" && "bg-success hover:bg-success/90",
              )}
            >
              {editing ? "Save changes" : type === "income" ? "Save income" : "Save expense"}
            </Button>
          </div>
        ) : (
          <div className="bg-muted/40 mt-1 border-t">
            <Numpad
              onKey={handleKey}
              onSave={submit}
              saveDisabled={!canSave}
              type={type}
            />
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. If the `refs` construction reads awkwardly, extract `const cat = categories.find(...)` and `const acc = accounts.find(...)` above the payload and build `refs` from those — same behaviour, less repetition.

- [ ] **Step 4: Commit**

```bash
git add src/components/expenses/category-chips.tsx src/components/expenses/transaction-sheet.tsx
git commit -m "feat(expenses): add transaction sheet with numpad and keyboard modes"
```

---

### Task 12: Month view components

**Files:**
- Create: `src/components/expenses/month-switcher.tsx`
- Create: `src/components/expenses/month-summary.tsx`
- Create: `src/components/expenses/transaction-item.tsx`
- Create: `src/components/expenses/transaction-list.tsx`
- Create: `src/components/expenses/transaction-empty.tsx`
- Create: `src/components/expenses/transaction-skeleton.tsx`

**Interfaces:**
- Consumes: `formatMoneyCompact`, `formatSigned` from `@/lib/money`; `formatMonthLabel`, `formatDayLabel`, `shiftMonth`, `type MonthLedger` from `@/lib/expenses`; `TruncatedText` from `@/components/common/truncated-text`; `Skeleton` from `@/components/ui/skeleton`.
- Produces:
  - `<MonthSwitcher month onChange={(m: string) => void} />`
  - `<MonthSummary totals={LedgerTotals} />`
  - `<TransactionItem row onEdit onDelete />`
  - `<TransactionList ledger today onEdit onDelete />`
  - `<TransactionEmpty monthLabel onAdd />`
  - `<TransactionSkeleton />`

- [ ] **Step 1: Write the month switcher and summary**

Create `src/components/expenses/month-switcher.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatMonthLabel, shiftMonth } from "@/lib/expenses";
import { Button } from "@/components/ui/button";

export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <h1 className="text-lg font-semibold tracking-tight">
        {formatMonthLabel(month)}
      </h1>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
```

Create `src/components/expenses/month-summary.tsx`:

```tsx
import type { LedgerTotals } from "@/lib/expenses";
import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Three numbers, never more. The currency symbol is dropped inside the strip —
 * the whole page is one currency and the labels carry the meaning.
 *
 * "Left" is income minus expense for this month. It is not a bank balance and
 * must never be presented as one.
 */
export function MonthSummary({ totals }: { totals: LedgerTotals }) {
  const cells = [
    { label: "Spent", value: totals.expenseMinor, tone: "text-foreground" },
    { label: "Earned", value: totals.incomeMinor, tone: "text-success" },
    { label: "Left", value: totals.netMinor, tone: "text-primary" },
  ];

  return (
    <dl className="bg-card grid grid-cols-3 divide-x rounded-lg border">
      {cells.map((c) => (
        <div key={c.label} className="px-3 py-2.5">
          <dt className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            {c.label}
          </dt>
          <dd
            className={cn(
              "truncate text-[15px] font-semibold tracking-tight tabular-nums",
              c.tone,
            )}
          >
            {formatMoneyCompact(c.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 2: Write the row, list, empty and skeleton**

Create `src/components/expenses/transaction-item.tsx`:

```tsx
"use client";

import { Repeat2, Trash2 } from "lucide-react";

import { TruncatedText } from "@/components/common/truncated-text";
import { Button } from "@/components/ui/button";
import type { TransactionType } from "@/lib/expenses";
import { formatSigned } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/server/services/transaction.service";

export function TransactionItem({
  row,
  onEdit,
  onDelete,
}: {
  row: TransactionRow;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
}) {
  const income = row.type === "income";
  const subtitle = [row.category?.name ?? "Uncategorized", row.account?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="hover:bg-muted/60 flex min-w-0 items-center gap-3 border-t px-1 transition-colors">
      <button
        type="button"
        onClick={() => onEdit(row)}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg text-base"
        >
          {row.category?.icon ?? "•"}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          {/* `interactive={false}`: this text sits inside a clickable row, so
              the reveal is hover-only and taps pass through to Edit. */}
          <TruncatedText
            text={row.note?.trim() || row.category?.name || "Entry"}
            interactive={false}
            className="text-sm font-medium"
          />
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            {row.recurringId ? (
              <span className="bg-muted rounded px-1 py-px text-[10px] font-semibold">
                <Repeat2 className="mr-0.5 inline size-3" />
                Repeats
              </span>
            ) : null}
            <span className="truncate">{subtitle}</span>
          </span>
        </span>

        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            income && "text-success",
          )}
        >
          {formatSigned(row.amountMinor, row.type as TransactionType)}
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete entry"
        onClick={() => onDelete(row)}
        className="text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
```

Create `src/components/expenses/transaction-list.tsx`:

```tsx
"use client";

import { formatDayLabel, type MonthLedger } from "@/lib/expenses";
import { formatSigned } from "@/lib/money";
import type { TransactionRow } from "@/server/services/transaction.service";

import { TransactionItem } from "./transaction-item";

export function TransactionList({
  ledger,
  today,
  onEdit,
  onDelete,
}: {
  ledger: MonthLedger<TransactionRow>;
  today: string;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
}) {
  return (
    <div className="flex flex-col">
      {ledger.days.map((day) => (
        <section key={day.date}>
          <header className="bg-background/85 text-muted-foreground sticky top-0 z-10 flex items-baseline justify-between gap-2 py-2 text-xs font-semibold backdrop-blur">
            <span>{formatDayLabel(day.date, today)}</span>
            {/* Both figures on a day with income — a net would mislead. */}
            <span className="tabular-nums">
              {day.expenseMinor > 0 ? formatSigned(day.expenseMinor, "expense") : null}
              {day.expenseMinor > 0 && day.incomeMinor > 0 ? " · " : null}
              {day.incomeMinor > 0 ? formatSigned(day.incomeMinor, "income") : null}
            </span>
          </header>

          {day.items.map((row) => (
            <TransactionItem
              key={row.id}
              row={row}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
```

Create `src/components/expenses/transaction-empty.tsx`:

```tsx
"use client";

import { Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

export function TransactionEmpty({
  monthLabel,
  onAdd,
}: {
  monthLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <Wallet className="text-muted-foreground size-8" aria-hidden />
      <p className="text-muted-foreground text-sm">
        Nothing logged for {monthLabel} yet.
      </p>
      <Button onClick={onAdd}>
        <Plus className="size-4" />
        Add your first entry
      </Button>
    </div>
  );
}
```

Create `src/components/expenses/transaction-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the day-grouped layout so the swap to real content doesn't jump. */
export function TransactionSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full rounded-lg" />
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 py-2">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-3.5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Confirm the TruncatedText contract**

Run: `grep -n "text:\|interactive" src/components/common/truncated-text.tsx`
Expected: it takes `text` (a string prop, **not** children), `className`, `as`, and `interactive`. Nesting it inside a clickable row without `interactive={false}` reintroduces the double-interaction bug fixed in commit `5e5b398`.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/expenses
git commit -m "feat(expenses): add month view list, summary and states"
```

---

### Task 13: Expenses view, page and navigation

**Files:**
- Create: `src/components/expenses/expenses-view.tsx`
- Create: `src/app/(app)/expenses/page.tsx`
- Create: `src/app/(app)/expenses/loading.tsx`
- Modify: `src/components/nav/app-nav.tsx` (the `NAV_ITEMS` array)

**Interfaces:**
- Consumes: everything from Tasks 9–12; `getQueryClient` from `@/lib/query/server`; `requireUserId` from `@/lib/get-session`; `listMonth`, `listFinanceCategories`, `listAccounts` services.
- Produces: the `/expenses` route.

> **Read the Next.js page and `loading.tsx` docs in `node_modules/next/dist/docs/` before writing this task.** Mirror `src/app/(app)/todos/page.tsx`, which prefetches on the server and hydrates the client cache — skipping that reintroduces the fetch waterfall fixed in commit `972ae1a`.

- [ ] **Step 1: Write the view**

Create `src/components/expenses/expenses-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { useLocalToday } from "@/hooks/use-local-today";
import {
  useDeleteTransaction,
  useTransactions,
} from "@/hooks/use-transactions";
import { currentMonthKey, formatMonthLabel } from "@/lib/expenses";
import type { TransactionRow } from "@/server/services/transaction.service";

import { MonthSummary } from "./month-summary";
import { MonthSwitcher } from "./month-switcher";
import { TransactionEmpty } from "./transaction-empty";
import { TransactionList } from "./transaction-list";
import { TransactionSheet } from "./transaction-sheet";
import { TransactionSkeleton } from "./transaction-skeleton";

export function ExpensesView({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  const today = useLocalToday();
  const query = useTransactions(month);
  const remove = useDeleteTransaction(month);

  function openAdd() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: TransactionRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  /**
   * Undo instead of a confirmation dialog: the action is reversible, so the
   * fast path stays fast and the mistake stays cheap (PRD 5B.3).
   */
  function handleDelete(row: TransactionRow) {
    remove.mutate(row.id, { onError: (e) => toast.error(e.message) });
    toast.success("Entry deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          // Re-create it; a new id is fine, nothing references a transaction.
          void fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: row.type,
              amountMinor: row.amountMinor,
              categoryId: row.categoryId,
              accountId: row.accountId,
              occurredOn: row.occurredOn,
              note: row.note,
            }),
          }).then(() => query.refetch());
        },
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <MonthSwitcher month={month} onChange={setMonth} />

      {query.isPending ? (
        <TransactionSkeleton />
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <MonthSummary totals={query.data.totals} />

          {query.data.days.length === 0 ? (
            <TransactionEmpty
              monthLabel={formatMonthLabel(month)}
              onAdd={openAdd}
            />
          ) : (
            <TransactionList
              ledger={query.data}
              today={today}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <Button
        onClick={openAdd}
        className="fixed right-5 bottom-5 z-20 h-13 rounded-full px-5 text-base shadow-lg md:right-8 md:bottom-8"
      >
        <Plus className="size-5" />
        Add
      </Button>

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        month={month}
        editing={editing}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the page and loading state**

Create `src/app/(app)/expenses/page.tsx`:

```tsx
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { ExpensesView } from "@/components/expenses/expenses-view";
import { currentMonthKey } from "@/lib/expenses";
import { requireUserId } from "@/lib/get-session";
import { getQueryClient } from "@/lib/query/server";
import { listAccounts } from "@/server/services/account.service";
import { listFinanceCategories } from "@/server/services/finance-category.service";
import { listMonth } from "@/server/services/transaction.service";

export const metadata: Metadata = { title: "Expenses — Toreha" };

export default async function ExpensesPage() {
  const userId = await requireUserId();
  const queryClient = getQueryClient();
  const month = currentMonthKey();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["transactions", month],
      queryFn: () => listMonth(userId, month),
    }),
    queryClient.prefetchQuery({
      queryKey: ["finance-categories"],
      queryFn: () => listFinanceCategories(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ["accounts"],
      queryFn: () => listAccounts(userId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExpensesView initialMonth={month} />
    </HydrationBoundary>
  );
}
```

Create `src/app/(app)/expenses/loading.tsx`:

```tsx
import { TransactionSkeleton } from "@/components/expenses/transaction-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <TransactionSkeleton />
    </div>
  );
}
```

- [ ] **Step 3: Add the navigation item**

In `src/components/nav/app-nav.tsx`, add `Wallet` to the `lucide-react` import and append to `NAV_ITEMS`:

```ts
{ href: "/expenses", label: "Expenses", icon: Wallet },
```

- [ ] **Step 4: Verify in the browser**

Run `pnpm dev` and walk the flow:

1. `/expenses` renders the current month with real numbers on first paint (no flash of skeleton on a warm navigation).
2. **＋ Add** → numpad → type `25` `000` → tap a category → **Save**. The row appears immediately at the top of today.
3. Toggle **⌨ Keyboard** → the numpad collapses, the amount field accepts typed digits, and a full-width Save sits above it. Close and reopen the sheet — it remembers keyboard mode.
4. Switch to **Income** → the amount and Save turn green, and the chips swap to income categories.
5. Tap a row → the sheet opens prefilled → change the amount → **Save changes**.
6. Delete a row → the toast offers **Undo** → undo restores it.
7. `‹` and `›` move months; an empty month shows the empty state, not a blank screen.
8. Narrow the window to 375px: nothing overflows horizontally, and a long note truncates rather than stretching the row.

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/components/expenses/expenses-view.tsx "src/app/(app)/expenses" src/components/nav/app-nav.tsx
git commit -m "feat(expenses): add expenses page with server prefetch and nav entry"
```

---

### Task 14: Verification pass

**Files:** none created; fixes only.

- [ ] **Step 1: Run the full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all four clean. Fix anything that is not, then re-run the whole command — not just the failing part.

- [ ] **Step 2: Confirm the new-feature checklist (PRD §5A.6)**

Walk it explicitly and fix any miss:

- [ ] Module structure matches §5A.2 naming.
- [ ] A Zod schema exists for every input.
- [ ] Every query is scoped to `user_id`.
- [ ] Endpoints use the `{ data, error }` contract.
- [ ] Mutations use optimistic + rollback.
- [ ] Empty, loading and error states exist.
- [ ] Responsive and keyboard-accessible; tap targets ≥44px.
- [ ] No new pattern introduced without reason.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore(expenses): fix issues found in verification pass"
```

- [ ] **Step 4: Report**

Summarise for the owner: what shipped, the verification output, and what P2 (budgets and insights) picks up next. Do not push or open a PR — the owner handles remote operations.
