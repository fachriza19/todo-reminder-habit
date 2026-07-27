"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatMonthLabel, shiftMonth } from "@/lib/expenses";
import { Button } from "@/components/ui/button";

export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>

      <h1 className="text-lg font-semibold tracking-tight">
        {formatMonthLabel(month)}
      </h1>

      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
