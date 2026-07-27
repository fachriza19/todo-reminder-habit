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
        <div key={c.label} className="min-w-0 px-3 py-2.5">
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
