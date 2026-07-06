import type { Metadata } from "next";
import { TodosView } from "@/components/todo/todos-view";

export const metadata: Metadata = { title: "Todos — Toreha" };

export default function TodosPage() {
  return <TodosView />;
}
