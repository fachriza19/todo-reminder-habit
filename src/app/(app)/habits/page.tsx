import type { Metadata } from "next";
import { HabitsView } from "@/components/habit/habits-view";

export const metadata: Metadata = { title: "Habits — Toreha" };

export default function HabitsPage() {
  return <HabitsView />;
}
