import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { ExpensesView } from "@/components/expenses/expenses-view";
import { currentMonthKey, isValidMonthKey } from "@/lib/expenses";
import { requireUserId } from "@/lib/get-session";
import { getQueryClient } from "@/lib/query/server";
import { listAccounts } from "@/server/services/account.service";
import { listFinanceCategories } from "@/server/services/finance-category.service";
import { listMonth } from "@/server/services/transaction.service";

export const metadata: Metadata = { title: "Expenses — Toreha" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const userId = await requireUserId();
  const queryClient = getQueryClient();

  // Prefetch the month actually being viewed, so a shared/bookmarked link
  // paints real numbers instead of a skeleton.
  const requested = (await searchParams).m;
  const month =
    requested && isValidMonthKey(requested) ? requested : currentMonthKey();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["transactions", month],
      queryFn: () => listMonth(userId, month),
    }),
    queryClient.prefetchQuery({
      queryKey: ["finance-categories"],
      queryFn: () => listFinanceCategories(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ["accounts"],
      queryFn: () => listAccounts(userId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExpensesView initialMonth={month} />
    </HydrationBoundary>
  );
}
