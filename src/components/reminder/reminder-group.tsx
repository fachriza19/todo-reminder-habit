"use client";

import { cn } from "@/lib/utils";
import type { Reminder } from "@/db/schema";
import { ReminderItem } from "./reminder-item";

export function ReminderGroup({
  title,
  reminders,
  now,
  tone,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  reminders: Reminder[];
  now: number;
  tone?: "overdue";
  onToggle: (r: Reminder) => void;
  onEdit: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
}) {
  if (reminders.length === 0) return null;

  return (
    <section className="grid gap-2">
      <h2
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          tone === "overdue" ? "text-warning" : "text-muted-foreground",
        )}
      >
        {title}
        <span className="ml-1.5 font-normal">{reminders.length}</span>
      </h2>
      <ul className="grid gap-2">
        {reminders.map((r) => (
          <ReminderItem
            key={r.id}
            reminder={r}
            now={now}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}
