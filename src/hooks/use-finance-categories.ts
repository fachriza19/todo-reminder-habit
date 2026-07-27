"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FinanceCategory } from "@/db/schema";
import { apiFetch } from "@/lib/fetcher";
import type { CreateFinanceCategoryInput } from "@/lib/validations/finance-category";

const KEY = ["finance-categories"] as const;

export function useFinanceCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<FinanceCategory[]>("/api/finance-categories"),
  });
}

export function useCreateFinanceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFinanceCategoryInput) =>
      apiFetch<FinanceCategory>("/api/finance-categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
