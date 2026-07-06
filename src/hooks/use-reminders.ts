"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { epochNow, newId } from "@/lib/utils";
import type { Reminder } from "@/db/schema";
import type {
  CreateReminderInput,
  UpdateReminderInput,
} from "@/lib/validations/reminder";

const KEY = ["reminders"] as const;

export function useReminders() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<Reminder[]>("/api/reminders"),
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReminderInput) =>
      apiFetch<Reminder>("/api/reminders", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Reminder[]>(KEY) ?? [];
      const optimistic: Reminder = {
        id: newId(),
        userId: "",
        title: input.title,
        remindAt: input.remindAt,
        isDone: 0,
        recurrence: "none",
        recurrenceDays: null,
        createdAt: epochNow(),
        completedAt: null,
      };
      qc.setQueryData<Reminder[]>(KEY, [...prev, optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateReminderInput }) =>
      apiFetch<Reminder>(`/api/reminders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Reminder[]>(KEY) ?? [];
      qc.setQueryData<Reminder[]>(
        KEY,
        prev.map((r) => {
          if (r.id !== id) return r;
          const next: Reminder = { ...r };
          if (patch.title !== undefined) next.title = patch.title;
          if (patch.remindAt !== undefined) next.remindAt = patch.remindAt;
          if (patch.isDone !== undefined) {
            next.isDone = patch.isDone ? 1 : 0;
            next.completedAt = patch.isDone ? epochNow() : null;
          }
          return next;
        }),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/reminders/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Reminder[]>(KEY) ?? [];
      qc.setQueryData<Reminder[]>(
        KEY,
        prev.filter((r) => r.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
