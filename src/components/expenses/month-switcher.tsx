"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatMonthLabel, shiftMonth } from "@/lib/expenses";
import { Button } from "@/components/ui/button";

/**
 * Stretches full width on mobile so both arrows sit under a thumb; collapses
 * to a compact left-aligned group on desktop, where a full-width control just
 * strands the label in the middle of the page.
 */
export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 md:justify-start">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>

      <p
        aria-live="polite"
        className="min-w-40 text-center text-base font-semibold tracking-tight"
      >
        {formatMonthLabel(month)}
      </p>

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
