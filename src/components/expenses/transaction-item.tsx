"use client";

import { Repeat2, Trash2 } from "lucide-react";

import { TruncatedText } from "@/components/common/truncated-text";
import { Button } from "@/components/ui/button";
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
  const title = row.note?.trim() || row.category?.name || "Entry";
  const subtitle = [row.category?.name ?? "Uncategorized", row.account?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group hover:bg-muted/60 flex min-w-0 items-center gap-2 border-t px-1 transition-colors">
      <button
        type="button"
        onClick={() => onEdit(row)}
        aria-label={`Edit ${title}`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg text-base"
        >
          {row.category?.icon ?? "•"}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          {/* interactive={false}: this sits inside a clickable row, so the
              reveal is hover-only and taps pass through to Edit. */}
          <TruncatedText
            text={title}
            interactive={false}
            className="text-sm font-medium"
          />
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            {row.recurringId ? (
              <span className="bg-muted shrink-0 rounded px-1 py-px text-[10px] font-semibold">
                <Repeat2 className="mr-0.5 inline size-3" aria-hidden />
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
          {formatSigned(row.amountMinor, row.type)}
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${title}`}
        onClick={() => onDelete(row)}
        className="row-actions text-muted-foreground hover:text-destructive size-10 shrink-0"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
