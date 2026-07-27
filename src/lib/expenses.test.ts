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
  // 27 Jul 2026 is a Monday.
  it("names today and yesterday", () => {
    expect(formatDayLabel("2026-07-27", "2026-07-27")).toBe("Today · Mon 27 Jul");
    expect(formatDayLabel("2026-07-26", "2026-07-27")).toBe(
      "Yesterday · Sun 26 Jul",
    );
  });

  it("uses a plain date for any other day", () => {
    expect(formatDayLabel("2026-07-25", "2026-07-27")).toBe("Sat 25 Jul");
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
