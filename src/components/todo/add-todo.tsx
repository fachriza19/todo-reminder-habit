"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { useCreateTodo } from "@/hooks/use-todos";
import { useTodoView } from "@/stores/todo-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AddTodo() {
  const [title, setTitle] = useState("");
  const create = useCreateTodo();
  const activeCategory = useTodoView((s) => s.activeCategory);

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    // New tasks inherit the active category filter (if a real category).
    const categoryId =
      activeCategory && activeCategory !== "none" ? activeCategory : null;
    setTitle("");
    create.mutate(
      { title: trimmed, categoryId },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        aria-label="Add a task"
        maxLength={200}
        className="h-11"
        autoComplete="off"
      />
      <Button
        type="submit"
        className="h-11 shrink-0"
        disabled={!title.trim()}
        aria-label="Add task"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">Add</span>
      </Button>
    </form>
  );
}
