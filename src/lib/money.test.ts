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
