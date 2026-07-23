"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { CategoryManager } from "./category-manager";
import { TruncatedText } from "@/components/common/truncated-text";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function CategoryFilter({
  categories,
  active,
  onSelect,
}: {
  categories: Category[];
  active: string | null;
  onSelect: (value: string | null) => void;
}) {
  const setActive = onSelect;

  return (
    <div className="flex items-center gap-2">
      <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
        <Chip active={active === null} onClick={() => setActive(null)}>
          All
        </Chip>
        <Chip active={active === "none"} onClick={() => setActive("none")}>
          Uncategorized
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={active === c.id}
            onClick={() => setActive(c.id)}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: c.color ?? "var(--muted-foreground)" }}
              aria-hidden
            />
            <TruncatedText text={c.name} className="max-w-32" />
          </Chip>
        ))}
      </div>
      <CategoryManager>
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Manage categories"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </CategoryManager>
    </div>
  );
}
