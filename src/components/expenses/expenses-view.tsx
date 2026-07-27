"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { useLocalToday } from "@/hooks/use-local-today";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
} from "@/hooks/use-transactions";
import { formatMonthLabel, isValidMonthKey } from "@/lib/expenses";
import type { TransactionRow } from "@/server/services/transaction.service";

import { MonthSummary } from "./month-summary";
import { MonthSwitcher } from "./month-switcher";
import { TransactionEmpty } from "./transaction-empty";
import { TransactionList } from "./transaction-list";
import { TransactionSheet } from "./transaction-sheet";
import { TransactionSkeleton } from "./transaction-skeleton";

export function ExpensesView({ initialMonth }: { initialMonth: string }) {
  // The month lives in the URL so a month is linkable and the back button
  // works. `history.pushState` integrates with useSearchParams, so the URL
  // updates without a server round trip on every arrow tap.
  const searchParams = useSearchParams();
  const param = searchParams.get("m");
  const month = param && isValidMonthKey(param) ? param : initialMonth;

  function setMonth(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("m", next);
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  const today = useLocalToday();
  const query = useTransactions(month);
  const remove = useDeleteTransaction(month);
  const create = useCreateTransaction(month);

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
   * fast path stays fast and the mistake stays cheap (PRD 5B.3). Undo
   * re-creates the entry — a new id is fine, nothing references a transaction.
   */
  function handleDelete(row: TransactionRow) {
    remove.mutate(row.id, { onError: (e) => toast.error(e.message) });

    toast.success("Entry deleted", {
      action: {
        label: "Undo",
        onClick: () =>
          create.mutate(
            {
              input: {
                type: row.type,
                amountMinor: row.amountMinor,
                categoryId: row.categoryId,
                accountId: row.accountId,
                occurredOn: row.occurredOn,
                note: row.note,
              },
              refs: { category: row.category, account: row.account },
            },
            { onError: (e) => toast.error(e.message) },
          ),
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
        className="fixed right-5 bottom-20 z-20 h-13 rounded-full px-5 text-base shadow-lg md:right-8 md:bottom-8"
      >
        <Plus className="size-5" aria-hidden />
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
