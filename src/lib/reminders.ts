import { format } from "date-fns";
import type { Reminder } from "@/db/schema";
import { getLocalToday } from "@/lib/utils";

export type ReminderGroups = {
  overdue: Reminder[];
  today: Reminder[];
  upcoming: Reminder[];
  completed: Reminder[];
};

/** A reminder is "due" when it's not done and its time has passed (F-REM-4). */
export function isDue(reminder: Reminder, now: number): boolean {
  return reminder.isDone === 0 && reminder.remindAt <= now;
}

function localDate(ms: number): string {
  return format(new Date(ms), "yyyy-MM-dd");
}

/**
 * Group reminders into Overdue / Today / Upcoming / Completed (F-REM-5).
 * Overdue = time already passed (any day). Today = still upcoming today.
 * Upcoming = a future day. Completed = done. Nearest first; completed newest
 * first. `today` comes from getLocalToday (the single "today" source).
 */
export function groupReminders(
  reminders: Reminder[],
  now: number,
  today: string = getLocalToday(),
): ReminderGroups {
  const groups: ReminderGroups = {
    overdue: [],
    today: [],
    upcoming: [],
    completed: [],
  };

  for (const r of reminders) {
    if (r.isDone === 1) {
      groups.completed.push(r);
      continue;
    }
    if (r.remindAt < now) groups.overdue.push(r);
    else if (localDate(r.remindAt) === today) groups.today.push(r);
    else groups.upcoming.push(r);
  }

  groups.overdue.sort((a, b) => a.remindAt - b.remindAt);
  groups.today.sort((a, b) => a.remindAt - b.remindAt);
  groups.upcoming.sort((a, b) => a.remindAt - b.remindAt);
  groups.completed.sort(
    (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0),
  );

  return groups;
}

/** Count of due (past-time, not done) reminders — the nav badge (F-REM-4). */
export function dueCount(reminders: Reminder[], now: number): number {
  return reminders.reduce((n, r) => (isDue(r, now) ? n + 1 : n), 0);
}
