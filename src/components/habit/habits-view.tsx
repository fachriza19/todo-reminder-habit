"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { HabitWithProgress } from "@/server/services/habit.service";
import { useHabits, useUpdateHabit, useDeleteHabit } from "@/hooks/use-habits";
import { Button } from "@/components/ui/button";
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
import { ErrorState } from "@/components/common/error-state";
import { HabitCard } from "./habit-card";
import { HabitForm } from "./habit-form";
import { HabitEmpty } from "./habit-empty";
import { HabitSkeleton } from "./habit-skeleton";

export function HabitsView() {
  const habitsQuery = useHabits();
  const update = useUpdateHabit();
  const del = useDeleteHabit();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HabitWithProgress | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HabitWithProgress | null>(
    null,
  );

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(habit: HabitWithProgress) {
    setEditing(habit);
    setFormOpen(true);
  }

  function archive(habit: HabitWithProgress) {
    update.mutate(
      { id: habit.id, patch: { isArchived: true } },
      {
        onError: (e) => toast.error(e.message),
        onSuccess: () => toast.success("Habit archived"),
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

  const habits = habitsQuery.data ?? [];

  return (
    <div className="grid gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          New habit
        </Button>
      </header>

      {habitsQuery.isPending ? (
        <HabitSkeleton />
      ) : habitsQuery.isError ? (
        <ErrorState
          title="Couldn't load your habits"
          message="Check your connection and try again."
          onRetry={() => habitsQuery.refetch()}
        />
      ) : habits.length === 0 ? (
        <HabitEmpty onAdd={openAdd} />
      ) : (
        <div className="grid gap-3">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onEdit={openEdit}
              onArchive={archive}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <HabitForm habit={editing} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{deleteTarget?.name}”?
            </AlertDialogTitle>
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
    </div>
  );
}
