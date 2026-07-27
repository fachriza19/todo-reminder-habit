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
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
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
