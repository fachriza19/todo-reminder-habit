import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/query/server";
import { requireUserId } from "@/lib/get-session";
import { listTodos } from "@/server/services/todo.service";
import { listCategories } from "@/server/services/category.service";
import { TodosView } from "@/components/todo/todos-view";

export const metadata: Metadata = { title: "Todos — Toreha" };

export default async function TodosPage() {
  const userId = await requireUserId();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["todos"],
      queryFn: () => listTodos(userId, { showDone: true }),
    }),
    queryClient.prefetchQuery({
      queryKey: ["categories"],
      queryFn: () => listCategories(userId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodosView />
    </HydrationBoundary>
  );
}
