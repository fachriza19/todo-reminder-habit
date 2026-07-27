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
  if (sameDayIndex === -1) return buildLedger([...rows, row]);
  return buildLedger([
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
  return buildLedger(rows.filter((r) => r.id !== id));
}

export function ledgerReplace<T extends LedgerRow>(
  ledger: MonthLedger<T>,
  id: string,
  row: T,
): MonthLedger<T> {
  const rows = flatten(ledger);
  if (!rows.some((r) => r.id === id)) return ledger;
  return buildLedger(rows.map((r) => (r.id === id ? row : r)));
}
