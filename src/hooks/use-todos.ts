"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { epochNow, newId } from "@/lib/utils";
import type { Todo } from "@/db/schema";
import type {
  CreateTodoInput,
  UpdateTodoInput,
} from "@/lib/validations/todo";

const KEY = ["todos"] as const;

/** Fetch all todos once; the view filters client-side for instant toggles. */
export function useTodos() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<Todo[]>("/api/todos?showDone=true"),
  });
}

function applyPatch(todo: Todo, patch: UpdateTodoInput): Todo {
  const next: Todo = { ...todo };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.notes !== undefined) next.notes = patch.notes ?? null;
  if (patch.categoryId !== undefined) next.categoryId = patch.categoryId ?? null;
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate ?? null;
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.isDone !== undefined) {
    next.isDone = patch.isDone ? 1 : 0;
    next.completedAt = patch.isDone ? epochNow() : null;
  }
  return next;
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoInput) =>
      apiFetch<Todo>("/api/todos", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Todo[]>(KEY) ?? [];
      const maxOrder = prev.reduce((m, t) => Math.max(m, t.sortOrder), -1);
      const optimistic: Todo = {
        id: newId(),
        userId: "",
        title: input.title,
        notes: input.notes ?? null,
        categoryId: input.categoryId ?? null,
        isDone: 0,
        sortOrder: maxOrder + 1,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? 0,
        createdAt: epochNow(),
        completedAt: null,
      };
      qc.setQueryData<Todo[]>(KEY, [...prev, optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTodoInput }) =>
      apiFetch<Todo>(`/api/todos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Todo[]>(KEY) ?? [];
      qc.setQueryData<Todo[]>(
        KEY,
        prev.map((t) => (t.id === id ? applyPatch(t, patch) : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/todos/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Todo[]>(KEY) ?? [];
      qc.setQueryData<Todo[]>(
        KEY,
        prev.filter((t) => t.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Persist a new order. `items` = the reordered visible subset. */
export function useReorderTodos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      apiFetch<{ ok: true }>("/api/todos/reorder", {
        method: "PATCH",
        body: JSON.stringify({ items }),
      }),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Todo[]>(KEY) ?? [];
      const orderById = new Map(items.map((i) => [i.id, i.sortOrder]));
      qc.setQueryData<Todo[]>(
        KEY,
        prev.map((t) =>
          orderById.has(t.id)
            ? { ...t, sortOrder: orderById.get(t.id)! }
            : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
