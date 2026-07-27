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
              {day.expenseMinor > 0
                ? formatSigned(day.expenseMinor, "expense")
                : null}
              {day.expenseMinor > 0 && day.incomeMinor > 0 ? " · " : null}
              {day.incomeMinor > 0
                ? formatSigned(day.incomeMinor, "income")
                : null}
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
