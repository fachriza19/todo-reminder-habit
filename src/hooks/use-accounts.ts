"use client";

import { useQuery } from "@tanstack/react-query";

import type { Account } from "@/db/schema";
import { apiFetch } from "@/lib/fetcher";

const KEY = ["accounts"] as const;

export function useAccounts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<Account[]>("/api/accounts"),
  });
}
