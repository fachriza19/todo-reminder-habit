"use client";

import type { FinanceCategory } from "@/db/schema";
import { cn } from "@/lib/utils";

/** Token names map to real classes so Tailwind can see them at build time. */
const DOT: Record<string, string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

/**
 * Toggle chips, not a dropdown: picking a category must not cost a second
 * screen. Tapping the selected chip clears it — uncategorized is legitimate.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: FinanceCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Category"
      className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : c.id)}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "bg-card hover:bg-muted",
            )}
          >
            {c.icon ? (
              <span aria-hidden>{c.icon}</span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  DOT[c.color ?? ""] ?? "bg-muted-foreground",
                )}
              />
            )}
            <span className="max-w-32 truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
