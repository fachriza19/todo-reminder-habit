"use client";

import { format, isToday } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Reminder } from "@/db/schema";
import { isDue } from "@/lib/reminders";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/common/truncated-text";

function formatRemindAt(ms: number): string {
  const d = new Date(ms);
  return isToday(d) ? format(d, "h:mm a") : format(d, "MMM d, h:mm a");
}

export function ReminderItem({
  reminder,
  now,
  onToggle,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  now: number;
  onToggle: (reminder: Reminder) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}) {
  const done = reminder.isDone === 1;
  const due = isDue(reminder, now);

  return (
    <li
      className={cn(
        "group bg-card animate-in fade-in-0 flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 duration-200",
        due && "border-warning/40 bg-warning/5",
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={() => onToggle(reminder)}
        aria-label={done ? "Mark as not done" : "Mark as complete"}
        className="size-6"
      />

      <button
        type="button"
        onClick={() => onEdit(reminder)}
        className="flex min-w-0 flex-1 flex-col items-start py-0.5 text-left"
      >
        <TruncatedText
          text={reminder.title}
          className={cn(
            "text-sm",
            done && "text-muted-foreground line-through",
          )}
        />
        <span
          className={cn(
            "text-xs",
            due ? "text-warning font-medium" : "text-muted-foreground",
          )}
        >
          {formatRemindAt(reminder.remindAt)}
          {due ? " · Due" : ""}
        </span>
      </button>

      <div className="row-actions flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label="Edit reminder"
          onClick={() => onEdit(reminder)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-10"
          aria-label="Delete reminder"
          onClick={() => onDelete(reminder)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
