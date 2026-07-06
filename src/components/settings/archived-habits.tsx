"use client";

import { useState } from "react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Habit } from "@/db/schema";
import {
  useArchivedHabits,
  useUpdateHabit,
  useDeleteHabit,
} from "@/hooks/use-habits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export function ArchivedHabits() {
  const query = useArchivedHabits();
  const update = useUpdateHabit();
  const del = useDeleteHabit();
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null);

  if (query.isPending) {
    return <Skeleton className="h-12 w-full" />;
  }
  if (query.isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn’t load archived habits.
      </p>
    );
  }

  const archived = query.data ?? [];
  if (archived.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No archived habits.</p>
    );
  }

  function unarchive(habit: Habit) {
    update.mutate(
      { id: habit.id, patch: { isArchived: false } },
      {
        onError: (e) => toast.error(e.message),
        onSuccess: () => toast.success("Habit restored"),
      },
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const habit = deleteTarget;
    setDeleteTarget(null);
    del.mutate(habit.id, {
      onError: (e) => toast.error(e.message),
      onSuccess: () => toast.success("Habit deleted"),
    });
  }

  return (
    <>
      <ul className="grid gap-1">
        {archived.map((habit) => (
          <li
            key={habit.id}
            className="flex items-center gap-2 rounded-md px-1 py-1"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {habit.name}
              <span className="text-muted-foreground">
                {" "}
                · target {habit.targetCount}
                {habit.unit ? ` ${habit.unit}` : ""}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => unarchive(habit)}
              aria-label={`Restore ${habit.name}`}
            >
              <ArchiveRestore className="size-4" />
              Restore
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-8"
              aria-label={`Delete ${habit.name}`}
              onClick={() => setDeleteTarget(habit)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the habit and all its history. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
