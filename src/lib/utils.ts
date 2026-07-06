import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The single source of truth for "today" (PRD 5A.5).
 * Returns the local calendar date as `YYYY-MM-DD`. Never compute dates ad-hoc
 * elsewhere — always route habit/reminder date logic through this helper.
 */
export function getLocalToday(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** Consistent server/client timestamp: epoch ms (PRD 5A.5). */
export function epochNow(): number {
  return Date.now();
}

/** Consistent id generation (PRD 5A.5). */
export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Streak = consecutive complete days ending today (PRD §6.5). A day is complete
 * when its count met the target. Today not being complete yet does NOT break the
 * streak — we count back from yesterday in that case (today is still in progress).
 */
export function computeStreak(
  completeDates: Set<string>,
  today: string = getLocalToday(),
): number {
  const todayDate = new Date(`${today}T00:00:00`);
  let cursor = completeDates.has(today) ? todayDate : subDays(todayDate, 1);
  let streak = 0;
  while (completeDates.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}
