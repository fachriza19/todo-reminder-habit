import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/query/server";
import { requireUserId } from "@/lib/get-session";
import { listTodos } from "@/server/services/todo.service";
import { listReminders } from "@/server/services/reminder.service";
import { TodayView } from "@/components/today/today-view";

export const metadata: Metadata = { title: "Today — Toreha" };

export default async function TodayPage() {
  const userId = await requireUserId();
  const queryClient = getQueryClient();

  // Prefetch the timezone-independent queries so they hydrate instantly.
  // Habits are intentionally NOT prefetched: their cache key includes the
  // browser's local date (see useHabits), which the server can't know, so a
  // server prefetch would land under a key the client never reads. Habits
  // still fetch once client-side.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["todos"],
      queryFn: () => listTodos(userId, { showDone: true }),
    }),
    queryClient.prefetchQuery({
      queryKey: ["reminders"],
      queryFn: () => listReminders(userId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodayView />
    </HydrationBoundary>
  );
}
