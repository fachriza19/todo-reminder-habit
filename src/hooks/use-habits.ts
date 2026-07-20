"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { epochNow, newId, getLocalToday } from "@/lib/utils";
import { useLocalToday } from "@/hooks/use-local-today";
import type { HabitWithProgress } from "@/server/services/habit.service";
import type { Habit, HabitLog } from "@/db/schema";
import type {
  CreateHabitInput,
  UpdateHabitInput,
} from "@/lib/validations/habit";

/**
 * Prefix key. Every habits query hangs off it, so invalidating KEY still
 * reaches the dated list and the archived list alike. NOT a cache address —
 * getQueryData/setQueryData match exactly, so those need the full dated key
 * from useHabitsKey().
 */
const KEY = ["habits"] as const;

/**
 * The cache address for the habits list: prefix + the browser's local date.
 *
 * The date is part of the key because habit progress is relative to the user's
 * local day. Keying by it means a page left open past midnight refetches
 * instead of serving yesterday's todayCount — which matters because the +1
 * control submits an absolute count derived from that value.
 */
function useHabitsKey() {
  const today = useLocalToday();
  return [...KEY, today] as const;
}

export function useHabits() {
  const today = useLocalToday();
  return useQuery({
    queryKey: [...KEY, today],
    queryFn: () =>
      apiFetch<HabitWithProgress[]>(`/api/habits?today=${today}`),
  });
}

const ARCHIVED_KEY = ["habits", "archived"] as const;

export function useArchivedHabits() {
  return useQuery({
    queryKey: ARCHIVED_KEY,
    queryFn: () => apiFetch<Habit[]>("/api/habits?archived=1"),
  });
}

export function useHabit(id: string) {
  const today = useLocalToday();
  return useQuery({
    queryKey: ["habit", id, today],
    queryFn: () =>
      apiFetch<HabitWithProgress>(`/api/habits/${id}?today=${today}`),
  });
}

export function useHabitHistory(habitId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["habit-history", habitId, from, to],
    queryFn: () =>
      apiFetch<HabitLog[]>(
        `/api/habits/${habitId}/history?from=${from}&to=${to}`,
      ),
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  const key = useHabitsKey();
  return useMutation({
    mutationFn: (input: CreateHabitInput) =>
      apiFetch<HabitWithProgress>("/api/habits", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<HabitWithProgress[]>(key) ?? [];
      const optimistic: HabitWithProgress = {
        id: newId(),
        userId: "",
        name: input.name,
        targetCount: input.targetCount,
        unit: input.unit ?? null,
        color: input.color ?? null,
        sortOrder: prev.length,
        isArchived: 0,
        createdAt: epochNow(),
        todayCount: 0,
        streak: 0,
      };
      qc.setQueryData<HabitWithProgress[]>(key, [...prev, optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  const key = useHabitsKey();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateHabitInput }) =>
      apiFetch<Habit>(`/api/habits/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<HabitWithProgress[]>(key) ?? [];
      // Archived habits drop out of the active list; strip isArchived (boolean)
      // from the field merge since the stored column is numeric.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isArchived, ...fields } = patch;
      const next =
        patch.isArchived === true
          ? prev.filter((h) => h.id !== id)
          : prev.map((h) =>
              h.id === id
                ? {
                    ...h,
                    ...fields,
                    unit: fields.unit ?? h.unit,
                    color: fields.color ?? h.color,
                  }
                : h,
            );
      qc.setQueryData<HabitWithProgress[]>(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ARCHIVED_KEY });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  const key = useHabitsKey();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/habits/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<HabitWithProgress[]>(key) ?? [];
      qc.setQueryData<HabitWithProgress[]>(
        key,
        prev.filter((h) => h.id !== id),
      );
      const prevArchived = qc.getQueryData<Habit[]>(ARCHIVED_KEY) ?? [];
      qc.setQueryData<Habit[]>(
        ARCHIVED_KEY,
        prevArchived.filter((h) => h.id !== id),
      );
      return { prev, prevArchived };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      if (ctx?.prevArchived) qc.setQueryData(ARCHIVED_KEY, ctx.prevArchived);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ARCHIVED_KEY });
    },
  });
}

/**
 * Set today's count for a habit. Optimistically updates the progress ring and
 * nudges the streak when today crosses the target boundary; the server value
 * reconciles on settle.
 */
export function useLogHabit() {
  const qc = useQueryClient();
  const key = useHabitsKey();
  return useMutation({
    // The write date is read fresh at submit time rather than taken from the
    // render-time key: a click just after midnight must land on the new day.
    // For up to one tick the key can still point at the previous day, which
    // only stales the optimistic paint — onSettled invalidates the prefix, so
    // both days refetch.
    mutationFn: ({ habitId, count }: { habitId: string; count: number }) =>
      apiFetch<HabitLog>(`/api/habits/${habitId}/log`, {
        method: "POST",
        body: JSON.stringify({ date: getLocalToday(), count }),
      }),
    onMutate: async ({ habitId, count }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<HabitWithProgress[]>(key) ?? [];
      qc.setQueryData<HabitWithProgress[]>(
        key,
        prev.map((h) => {
          if (h.id !== habitId) return h;
          const wasComplete = h.todayCount >= h.targetCount;
          const nowComplete = count >= h.targetCount;
          let streak = h.streak;
          if (!wasComplete && nowComplete) streak += 1;
          else if (wasComplete && !nowComplete) streak = Math.max(0, streak - 1);
          return { ...h, todayCount: count, streak };
        }),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: (_d, _e, { habitId }) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["habit", habitId] });
      qc.invalidateQueries({ queryKey: ["habit-history", habitId] });
    },
  });
}
