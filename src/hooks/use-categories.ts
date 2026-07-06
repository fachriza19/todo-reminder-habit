"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { epochNow, newId } from "@/lib/utils";
import type { Category } from "@/db/schema";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/validations/category";

const KEY = ["categories"] as const;

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<Category[]>("/api/categories"),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      apiFetch<Category>("/api/categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Category[]>(KEY) ?? [];
      const optimistic: Category = {
        id: newId(),
        userId: "",
        name: input.name,
        color: input.color ?? null,
        sortOrder: prev.length,
        createdAt: epochNow(),
      };
      qc.setQueryData<Category[]>(KEY, [...prev, optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCategoryInput }) =>
      apiFetch<Category>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Category[]>(KEY) ?? [];
      qc.setQueryData<Category[]>(
        KEY,
        prev.map((c) =>
          c.id === id
            ? { ...c, ...patch, color: patch.color ?? c.color }
            : c,
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

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/categories/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Category[]>(KEY) ?? [];
      qc.setQueryData<Category[]>(
        KEY,
        prev.filter((c) => c.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}
