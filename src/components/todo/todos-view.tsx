"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Todo } from "@/db/schema";
import { apiFetch } from "@/lib/fetcher";
import {
  useTodos,
  useUpdateTodo,
  useReorderTodos,
} from "@/hooks/use-todos";
import { useCategories } from "@/hooks/use-categories";
import { useTodoView } from "@/stores/todo-view";
import { useIsMounted } from "@/hooks/use-is-mounted";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/common/error-state";
import { AddTodo } from "./add-todo";
import { CategoryFilter } from "./category-filter";
import { TodoList } from "./todo-list";
import { TodoForm } from "./todo-form";
import { TodoEmpty } from "./todo-empty";
import { TodoSkeleton } from "./todo-skeleton";

const TODOS_KEY = ["todos"] as const;

function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort(
    (a, b) =>
      a.isDone - b.isDone ||
      a.sortOrder - b.sortOrder ||
      a.createdAt - b.createdAt,
  );
}

export function TodosView() {
  const todosQuery = useTodos();
  const { data: categories = [] } = useCategories();
  const update = useUpdateTodo();
  const reorder = useReorderTodos();
  const qc = useQueryClient();

  const showDone = useTodoView((s) => s.showDone);
  const toggleShowDone = useTodoView((s) => s.toggleShowDone);
  const activeCategory = useTodoView((s) => s.activeCategory);
  const setActiveCategory = useTodoView((s) => s.setActiveCategory);

  // Gate persisted values so the first render matches the server (defaults).
  const mounted = useIsMounted();
  const effectiveShowDone = mounted ? showDone : true;
  const effectiveCategory = mounted ? activeCategory : null;

  const [editing, setEditing] = useState<Todo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories],
  );

  const visible = useMemo(() => {
    const all = todosQuery.data ?? [];
    const filtered = all.filter((t) => {
      if (!effectiveShowDone && t.isDone === 1) return false;
      if (effectiveCategory === null) return true;
      if (effectiveCategory === "none") return t.categoryId === null;
      return t.categoryId === effectiveCategory;
    });
    return sortTodos(filtered);
  }, [todosQuery.data, effectiveShowDone, effectiveCategory]);

  function handleToggleDone(todo: Todo) {
    update.mutate(
      { id: todo.id, patch: { isDone: todo.isDone === 0 } },
      { onError: (e) => toast.error(e.message) },
    );
  }

  function handleEdit(todo: Todo) {
    setEditing(todo);
    setDialogOpen(true);
  }

  /** Delete with an undo window instead of a confirm dialog (PRD 5B.3). */
  function handleDelete(todo: Todo) {
    const prev = qc.getQueryData<Todo[]>(TODOS_KEY) ?? [];
    qc.setQueryData<Todo[]>(
      TODOS_KEY,
      prev.filter((t) => t.id !== todo.id),
    );

    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await apiFetch(`/api/todos/${todo.id}`, { method: "DELETE" });
      } catch {
        qc.setQueryData<Todo[]>(TODOS_KEY, (cur = []) =>
          sortTodos([...cur.filter((t) => t.id !== todo.id), todo]),
        );
        toast.error("Couldn't delete the task.");
      } finally {
        qc.invalidateQueries({ queryKey: TODOS_KEY });
      }
    }, 5000);

    toast("Task deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          qc.setQueryData<Todo[]>(TODOS_KEY, (cur = []) =>
            sortTodos([...cur.filter((t) => t.id !== todo.id), todo]),
          );
        },
      },
    });
  }

  function handleReorder(items: { id: string; sortOrder: number }[]) {
    reorder.mutate(items, { onError: (e) => toast.error(e.message) });
  }

  const total = todosQuery.data?.length ?? 0;

  return (
    <div className="grid gap-5">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
        {total > 0 ? (
          <span className="text-muted-foreground text-sm">
            {visible.filter((t) => t.isDone === 0).length} open
          </span>
        ) : null}
      </header>

      <AddTodo />

      <div className="grid gap-3">
        <CategoryFilter
          categories={categories}
          active={effectiveCategory}
          onSelect={setActiveCategory}
        />
        <div className="flex items-center justify-end gap-2">
          <Label htmlFor="show-done" className="text-muted-foreground text-sm">
            Show completed
          </Label>
          <Switch
            id="show-done"
            checked={effectiveShowDone}
            onCheckedChange={toggleShowDone}
          />
        </div>
      </div>

      {todosQuery.isPending ? (
        <TodoSkeleton />
      ) : todosQuery.isError ? (
        <ErrorState
          title="Couldn't load your tasks"
          message="Check your connection and try again."
          onRetry={() => todosQuery.refetch()}
        />
      ) : visible.length === 0 ? (
        <TodoEmpty
          filtered={effectiveCategory !== null || !effectiveShowDone}
        />
      ) : (
        <TodoList
          todos={visible}
          categoriesById={categoriesById}
          onToggleDone={handleToggleDone}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      )}

      <TodoForm
        todo={editing}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
