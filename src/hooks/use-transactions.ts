"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ledgerInsert,
  ledgerRemove,
  ledgerReplace,
  type MonthLedger,
} from "@/lib/expenses";
import { apiFetch } from "@/lib/fetcher";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/lib/validations/transaction";
import type { TransactionRow } from "@/server/services/transaction.service";

export type Ledger = MonthLedger<TransactionRow>;

/** Refs the optimistic row needs so it renders complete, not "Uncategorized". */
export type TransactionRefs = Pick<TransactionRow, "category" | "account">;

export function transactionsKey(month: string) {
  return ["transactions", month] as const;
}

const EMPTY: Ledger = {
  days: [],
  totals: { expenseMinor: 0, incomeMinor: 0, netMinor: 0 },
};

export function useTransactions(month: string) {
  return useQuery({
    queryKey: transactionsKey(month),
    queryFn: () =>
      apiFetch<Ledger>(`/api/transactions?month=${encodeURIComponent(month)}`),
  });
}

/**
 * Optimistic row for a create. Its id is discarded when the server responds;
 * the category and account labels come from the caller so the row renders
 * complete rather than flickering once the refetch lands.
 */
function optimisticRow(
  input: CreateTransactionInput,
  refs: TransactionRefs,
): TransactionRow {
  const now = epochNow();
  return {
    id: newId(),
    userId: "",
    type: input.type,
    amountMinor: input.amountMinor,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    occurredOn: input.occurredOn,
    note: input.note ?? null,
    recurringId: null,
    createdAt: now,
    updatedAt: now,
    category: refs.category,
    account: refs.account,
  };
}

export function useCreateTransaction(month: string) {
  const qc = useQueryClient();
  const key = transactionsKey(month);

  return useMutation({
    mutationFn: (vars: {
      input: CreateTransactionInput;
      refs: TransactionRefs;
    }) =>
      apiFetch<TransactionRow>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(vars.input),
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Ledger>(key) ?? EMPTY;
      qc.setQueryData<Ledger>(
        key,
        ledgerInsert(prev, optimisticRow(vars.input, vars.refs)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateTransaction(month: string) {
  const qc = useQueryClient();
  const key = transactionsKey(month);

  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: UpdateTransactionInput;
      refs?: TransactionRefs;
    }) =>
      apiFetch<TransactionRow>(`/api/transactions/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify(vars.patch),
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Ledger>(key) ?? EMPTY;
      const current = prev.days
        .flatMap((d) => d.items)
        .find((r) => r.id === vars.id);

      if (current) {
        const next: TransactionRow = {
          ...current,
          type: vars.patch.type ?? current.type,
          amountMinor: vars.patch.amountMinor ?? current.amountMinor,
          categoryId:
            vars.patch.categoryId === undefined
              ? current.categoryId
              : (vars.patch.categoryId ?? null),
          accountId:
            vars.patch.accountId === undefined
              ? current.accountId
              : (vars.patch.accountId ?? null),
          occurredOn: vars.patch.occurredOn ?? current.occurredOn,
          note:
            vars.patch.note === undefined
              ? current.note
              : (vars.patch.note ?? null),
          category: vars.refs ? vars.refs.category : current.category,
          account: vars.refs ? vars.refs.account : current.account,
          updatedAt: epochNow(),
        };
        qc.setQueryData<Ledger>(key, ledgerReplace(prev, vars.id, next));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteTransaction(month: string) {
  const qc = useQueryClient();
  const key = transactionsKey(month);

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/transactions/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Ledger>(key) ?? EMPTY;
      qc.setQueryData<Ledger>(key, ledgerRemove(prev, id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
