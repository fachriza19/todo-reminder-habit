import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/query/server";
import { requireUserId } from "@/lib/get-session";
import { listReminders } from "@/server/services/reminder.service";
import { RemindersView } from "@/components/reminder/reminders-view";

export const metadata: Metadata = { title: "Reminders — Toreha" };

export default async function RemindersPage() {
  const userId = await requireUserId();
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["reminders"],
    queryFn: () => listReminders(userId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RemindersView />
    </HydrationBoundary>
  );
}
