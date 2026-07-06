"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { Reminder } from "@/db/schema";
import { apiFetch } from "@/lib/fetcher";
import { getLocalToday } from "@/lib/utils";
import { groupReminders } from "@/lib/reminders";
import { useReminders, useUpdateReminder } from "@/hooks/use-reminders";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { ReminderGroup } from "./reminder-group";
import { ReminderForm } from "./reminder-form";
import { ReminderEmpty } from "./reminder-empty";
import { ReminderSkeleton } from "./reminder-skeleton";

const KEY = ["reminders"] as const;

export function RemindersView() {
  const remindersQuery = useReminders();
  const update = useUpdateReminder();
  const qc = useQueryClient();
  const now = useNow();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);

  const groups = useMemo(
    () => groupReminders(remindersQuery.data ?? [], now, getLocalToday()),
    [remindersQuery.data, now],
  );

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(reminder: Reminder) {
    setEditing(reminder);
    setFormOpen(true);
  }

  function toggle(reminder: Reminder) {
    update.mutate(
      { id: reminder.id, patch: { isDone: reminder.isDone === 0 } },
      { onError: (e) => toast.error(e.message) },
    );
  }

  /** Delete with an undo window (PRD 5B.3). */
  function handleDelete(reminder: Reminder) {
    const prev = qc.getQueryData<Reminder[]>(KEY) ?? [];
    qc.setQueryData<Reminder[]>(
      KEY,
      prev.filter((r) => r.id !== reminder.id),
    );

    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await apiFetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
      } catch {
        qc.setQueryData<Reminder[]>(KEY, (cur = []) => [
          ...cur.filter((r) => r.id !== reminder.id),
          reminder,
        ]);
        toast.error("Couldn't delete the reminder.");
      } finally {
        qc.invalidateQueries({ queryKey: KEY });
      }
    }, 5000);

    toast("Reminder deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          qc.setQueryData<Reminder[]>(KEY, (cur = []) => [
            ...cur.filter((r) => r.id !== reminder.id),
            reminder,
          ]);
        },
      },
    });
  }

  const total = remindersQuery.data?.length ?? 0;

  return (
    <div className="grid gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          New reminder
        </Button>
      </header>

      {remindersQuery.isPending ? (
        <ReminderSkeleton />
      ) : remindersQuery.isError ? (
        <ErrorState
          title="Couldn't load your reminders"
          message="Check your connection and try again."
          onRetry={() => remindersQuery.refetch()}
        />
      ) : total === 0 ? (
        <ReminderEmpty onAdd={openAdd} />
      ) : (
        <div className="grid gap-6">
          <ReminderGroup
            title="Overdue"
            tone="overdue"
            reminders={groups.overdue}
            now={now}
            onToggle={toggle}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          <ReminderGroup
            title="Today"
            reminders={groups.today}
            now={now}
            onToggle={toggle}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          <ReminderGroup
            title="Upcoming"
            reminders={groups.upcoming}
            now={now}
            onToggle={toggle}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          <ReminderGroup
            title="Completed"
            reminders={groups.completed}
            now={now}
            onToggle={toggle}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </div>
      )}

      <ReminderForm
        reminder={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
