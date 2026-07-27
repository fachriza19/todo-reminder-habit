"use client";

import { Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

export function TransactionEmpty({
  monthLabel,
  onAdd,
}: {
  monthLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <Wallet className="text-muted-foreground size-8" aria-hidden />
      <p className="text-muted-foreground text-sm">
        Nothing logged for {monthLabel} yet.
      </p>
      <Button onClick={onAdd}>
        <Plus className="size-4" aria-hidden />
        Add your first entry
      </Button>
    </div>
  );
}
