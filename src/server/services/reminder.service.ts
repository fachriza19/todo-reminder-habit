import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { reminders, type Reminder } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateReminderInput,
  UpdateReminderInput,
} from "@/lib/validations/reminder";

/**
 * All reminders for a user, earliest first. Scoped to userId. Grouping
 * (Overdue/Today/Upcoming/Completed) is computed on the client since it depends
 * on the local "now" (PRD 7.2).
 */
export async function listReminders(userId: string): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .orderBy(asc(reminders.remindAt));
}

export async function createReminder(
  userId: string,
  input: CreateReminderInput,
): Promise<Reminder> {
  const row: Reminder = {
    id: newId(),
    userId,
    title: input.title,
    remindAt: input.remindAt,
    isDone: 0,
    // Recurrence columns exist but are unused in MVP (one-time only).
    recurrence: "none",
    recurrenceDays: null,
    createdAt: epochNow(),
    completedAt: null,
  };
  await db.insert(reminders).values(row);
  return row;
}

export async function updateReminder(
  userId: string,
  id: string,
  input: UpdateReminderInput,
): Promise<Reminder> {
  const patch: Partial<Reminder> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.remindAt !== undefined) patch.remindAt = input.remindAt;
  if (input.isDone !== undefined) {
    patch.isDone = input.isDone ? 1 : 0;
    patch.completedAt = input.isDone ? epochNow() : null;
  }

  const updated = await db
    .update(reminders)
    .set(patch)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That reminder no longer exists.");
  }
  return updated[0];
}

export async function deleteReminder(
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await db
    .delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .returning({ id: reminders.id });

  if (deleted.length === 0) {
    throw new AppError("NOT_FOUND", "That reminder no longer exists.");
  }
}
