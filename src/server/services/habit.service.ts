import { and, eq, asc, max, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { habits, habitLogs, type Habit, type HabitLog } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId, getLocalToday, computeStreak } from "@/lib/utils";
import type {
  CreateHabitInput,
  UpdateHabitInput,
  LogHabitInput,
} from "@/lib/validations/habit";

export type HabitWithProgress = Habit & {
  todayCount: number;
  streak: number;
};

/**
 * List non-archived habits with today's count + current streak. Scoped to
 * userId. Streak uses getLocalToday() — the single "today" source (PRD 5A.5).
 */
export async function listHabits(
  userId: string,
): Promise<HabitWithProgress[]> {
  const rows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.isArchived, 0)))
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt));

  if (rows.length === 0) return [];

  const logs = await db
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.userId, userId));

  const today = getLocalToday();
  const logsByHabit = new Map<string, HabitLog[]>();
  for (const log of logs) {
    const list = logsByHabit.get(log.habitId) ?? [];
    list.push(log);
    logsByHabit.set(log.habitId, list);
  }

  return rows.map((habit) => {
    const hlogs = logsByHabit.get(habit.id) ?? [];
    const todayCount =
      hlogs.find((l) => l.date === today)?.count ?? 0;
    const completeDates = new Set(
      hlogs.filter((l) => l.count >= habit.targetCount).map((l) => l.date),
    );
    return {
      ...habit,
      todayCount,
      streak: computeStreak(completeDates, today),
    };
  });
}

/** Archived habits for the settings screen (no progress needed). Scoped to userId. */
export async function listArchivedHabits(userId: string): Promise<Habit[]> {
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.isArchived, 1)))
    .orderBy(asc(habits.name));
}

export async function createHabit(
  userId: string,
  input: CreateHabitInput,
): Promise<HabitWithProgress> {
  const [{ value: maxOrder } = { value: null }] = await db
    .select({ value: max(habits.sortOrder) })
    .from(habits)
    .where(eq(habits.userId, userId));

  const row: Habit = {
    id: newId(),
    userId,
    name: input.name,
    targetCount: input.targetCount,
    unit: input.unit ?? null,
    color: input.color ?? null,
    sortOrder: (maxOrder ?? -1) + 1,
    isArchived: 0,
    createdAt: epochNow(),
  };
  await db.insert(habits).values(row);
  return { ...row, todayCount: 0, streak: 0 };
}

export async function updateHabit(
  userId: string,
  id: string,
  input: UpdateHabitInput,
): Promise<Habit> {
  const patch: Partial<Habit> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.targetCount !== undefined) patch.targetCount = input.targetCount;
  if (input.unit !== undefined) patch.unit = input.unit ?? null;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.isArchived !== undefined)
    patch.isArchived = input.isArchived ? 1 : 0;

  const updated = await db
    .update(habits)
    .set(patch)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That habit no longer exists.");
  }
  return updated[0];
}

export async function deleteHabit(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning({ id: habits.id });

  if (deleted.length === 0) {
    throw new AppError("NOT_FOUND", "That habit no longer exists.");
  }
}

/**
 * Upsert a day's count for a habit (F-HAB-3). Absolute count, so +1/−1 and
 * direct entry share one idempotent path. One log per (habit, date).
 */
export async function logHabit(
  userId: string,
  habitId: string,
  input: LogHabitInput,
): Promise<HabitLog> {
  // Ownership check (F-AUTH-6) before writing the log.
  const owner = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
  if (owner.length === 0) {
    throw new AppError("NOT_FOUND", "That habit no longer exists.");
  }

  const now = epochNow();
  const inserted = await db
    .insert(habitLogs)
    .values({
      id: newId(),
      userId,
      habitId,
      date: input.date,
      count: input.count,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [habitLogs.habitId, habitLogs.date],
      set: { count: input.count, updatedAt: now },
    })
    .returning();

  return inserted[0];
}

/** Logs in a date range for the calendar history (F-HAB-6). Scoped to userId. */
export async function getHabitHistory(
  userId: string,
  habitId: string,
  from: string,
  to: string,
): Promise<HabitLog[]> {
  return db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        eq(habitLogs.habitId, habitId),
        gte(habitLogs.date, from),
        lte(habitLogs.date, to),
      ),
    )
    .orderBy(asc(habitLogs.date));
}

/** Single habit with progress (for the detail page). Scoped to userId. */
export async function getHabit(
  userId: string,
  id: string,
): Promise<HabitWithProgress> {
  const rows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)));
  if (rows.length === 0) {
    throw new AppError("NOT_FOUND", "That habit no longer exists.");
  }
  const habit = rows[0];
  const hlogs = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, id)));

  const today = getLocalToday();
  const todayCount = hlogs.find((l) => l.date === today)?.count ?? 0;
  const completeDates = new Set(
    hlogs.filter((l) => l.count >= habit.targetCount).map((l) => l.date),
  );
  return { ...habit, todayCount, streak: computeStreak(completeDates, today) };
}
