"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Category } from "@/db/schema";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/use-categories";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SWATCHES = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

export function CategoryManager({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: categories = [] } = useCategories();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            Organize tasks by category. Deleting one keeps its tasks (they become
            uncategorized).
          </DialogDescription>
        </DialogHeader>

        <NewCategoryForm />

        <ul className="grid gap-1">
          {categories.length === 0 ? (
            <li className="text-muted-foreground py-4 text-center text-sm">
              No categories yet.
            </li>
          ) : (
            categories.map((c) => <CategoryRow key={c.id} category={c} />)
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryForm() {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const create = useCreateCategory();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName("");
    create.mutate(
      { name: trimmed, color },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-2 rounded-lg border p-3"
    >
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          aria-label="New category name"
        />
        <Button type="submit" size="icon" disabled={!name.trim()} aria-label="Add category">
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`Color ${s}`}
            aria-pressed={color === s}
            onClick={() => setColor(s)}
            className={cn(
              "size-6 rounded-full ring-offset-2 ring-offset-background transition",
              color === s && "ring-ring ring-2",
            )}
            style={{ backgroundColor: s }}
          />
        ))}
      </div>
    </form>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [name, setName] = useState(category.name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useUpdateCategory();
  const del = useDeleteCategory();

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) {
      setName(category.name);
      return;
    }
    update.mutate(
      { id: category.id, patch: { name: trimmed } },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: category.color ?? "var(--muted-foreground)" }}
        aria-hidden
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={`Rename ${category.name}`}
        className="h-8 border-transparent px-2 shadow-none hover:border-input focus-visible:border-input"
      />
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive size-8 shrink-0"
        aria-label={`Delete ${category.name}`}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">Delete “{category.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its tasks stay and become uncategorized. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                del.mutate(category.id, {
                  onError: (e) => toast.error(e.message),
                  onSuccess: () => toast.success("Category deleted"),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
