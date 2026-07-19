"use client";

import { format, isToday } from "date-fns";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Reminder } from "@/db/schema";
import { useUpdateReminder } from "@/hooks/use-reminders";
import { Checkbox } from "@/components/ui/checkbox";

function formatRemindAt(ms: number): string {
  const d = new Date(ms);
  return isToday(d) ? format(d, "h:mm a") : format(d, "MMM d, h:mm a");
}

function ReminderRow({
  reminder,
  due,
  onToggle,
}: {
  reminder: Reminder;
  due: boolean;
  onToggle: (reminder: Reminder) => void;
}) {
  return (
    <li
      className={cn(
        "bg-card animate-in fade-in-0 flex items-center gap-3 rounded-lg border px-3 py-2.5 duration-200",
        due && "border-warning/40 bg-warning/5",
      )}
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => onToggle(reminder)}
        aria-label={`Complete “${reminder.title}”`}
        className="size-6"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{reminder.title}</span>
        <span
          className={cn(
            "text-xs",
            due ? "text-warning font-medium" : "text-muted-foreground",
          )}
        >
          {formatRemindAt(reminder.remindAt)}
          {due ? " · Due" : ""}
        </span>
      </div>
    </li>
  );
}

export function TodayReminders({
  overdue,
  today,
}: {
  overdue: Reminder[];
  today: Reminder[];
}) {
  const update = useUpdateReminder();

  function toggle(reminder: Reminder) {
    update.mutate(
      { id: reminder.id, patch: { isDone: true } },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <ul className="grid gap-2">
      {overdue.map((reminder) => (
        <ReminderRow
          key={reminder.id}
          reminder={reminder}
          due
          onToggle={toggle}
        />
      ))}
      {today.map((reminder) => (
        <ReminderRow
          key={reminder.id}
          reminder={reminder}
          due={false}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}
