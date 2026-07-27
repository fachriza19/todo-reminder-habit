"use client";

import type { TransactionType } from "@/lib/expenses";
import { CURRENCY, formatMoneyCompact, parseAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The amount is a real input in both modes — never a display-only element
 * wrapped around a custom widget. That keeps paste, dictation, hardware
 * keyboards and the system numeric keypad working, so the numpad stays an
 * affordance rather than the only path.
 *
 * `readOnly` in numpad mode stops the OS keyboard from sliding up over the pad
 * while still allowing focus, selection and copy.
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
        <span aria-hidden className="text-muted-foreground text-xl font-semibold">
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
