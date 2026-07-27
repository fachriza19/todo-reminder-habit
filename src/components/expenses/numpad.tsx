"use client";

import { Delete } from "lucide-react";

import type { TransactionType } from "@/lib/expenses";
import type { NumpadKey } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The in-sheet keypad, laid out as a 4×4 grid:
 *
 *     7  8  9  ┌──────┐
 *     4  5  6  │ Save │
 *     1  2  3    ⌫
 *     0     000  C
 *
 * Save spans two rows on the right — the largest and most thumb-reachable
 * target on the screen. `000` exists because rupiah amounts are thousands:
 * 25.000 is four taps. Zero is double-width so the grid has no empty cell.
 */
export function Numpad({
  onKey,
  onSave,
  saveDisabled,
  saveLabel,
  type,
}: {
  onKey: (key: NumpadKey) => void;
  onSave: () => void;
  saveDisabled: boolean;
  saveLabel: string;
  type: TransactionType;
}) {
  const keyClass = cn(
    "bg-card min-h-14 rounded-lg border text-xl font-medium tabular-nums transition-colors",
    "active:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
  );

  const digit = (k: NumpadKey, extra?: string) => (
    <button
      key={k}
      type="button"
      className={cn(keyClass, extra)}
      onClick={() => onKey(k)}
    >
      {k}
    </button>
  );

  return (
    <div className="grid grid-cols-4 gap-1.5 p-2">
      {(["7", "8", "9"] as const).map((k) => digit(k))}

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
        {saveLabel}
      </button>

      {(["4", "5", "6"] as const).map((k) => digit(k))}
      {(["1", "2", "3"] as const).map((k) => digit(k))}

      <button
        type="button"
        className={keyClass}
        onClick={() => onKey("del")}
        aria-label="Delete last digit"
      >
        <Delete className="mx-auto size-5" aria-hidden />
      </button>

      {digit("0", "col-span-2")}
      {digit("000", "text-base")}

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
