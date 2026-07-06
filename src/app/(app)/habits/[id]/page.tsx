import type { Metadata } from "next";
import { HabitDetail } from "@/components/habit/habit-detail";

export const metadata: Metadata = { title: "Habit — Toreha" };

export default async function HabitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HabitDetail id={id} />;
}
