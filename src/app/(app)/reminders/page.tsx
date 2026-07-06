import type { Metadata } from "next";
import { RemindersView } from "@/components/reminder/reminders-view";

export const metadata: Metadata = { title: "Reminders — Toreha" };

export default function RemindersPage() {
  return <RemindersView />;
}
