"use client";

import { format } from "date-fns";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Todo } from "@/db/schema";
import type { TodayTodoGroups } from "@/lib/today";
import { useUpdateTodo } from "@/hooks/use-todos";
import { Checkbox } from "@/components/ui/checkbox";

const PRIORITY_LABEL = ["None", "Low", "Medium", "High"];

function GroupLabel({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "overdue";
}) {
  return (
    <p
      className={cn(
        "text-xs font-medium",
        tone === "overdue" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function TodoRow({
  todo,
  meta,
  tone,
  onToggle,
}: {
  todo: Todo;
  meta?: string;
  tone?: "overdue";
  onToggle: (todo: Todo) => void;
}) {
  return (
    <li
      className={cn(
        "bg-card animate-in fade-in-0 flex items-center gap-3 rounded-lg border px-3 py-2.5 duration-200",
        tone === "overdue" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => onToggle(todo)}
        aria-label={`Mark “${todo.title}” as done`}
        className="size-6"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{todo.title}</span>
        {meta ? (
          <span
            className={cn(
              "text-xs",
              tone === "overdue"
                ? "text-destructive font-medium"
                : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        ) : null}
      </div>
      {todo.priority >= 2 ? (
        <Flag
          className={cn(
            "size-3.5 shrink-0",
            todo.priority === 3 ? "text-destructive" : "text-warning",
          )}
          aria-label={`${PRIORITY_LABEL[todo.priority]} priority`}
        />
      ) : null}
    </li>
  );
}

export function TodayTodos({ groups }: { groups: TodayTodoGroups }) {
  const update = useUpdateTodo();

  function toggle(todo: Todo) {
    update.mutate(
      { id: todo.id, patch: { isDone: true } },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <div className="grid gap-3">
      {groups.overdue.length > 0 ? (
        <div className="grid gap-2">
          <GroupLabel tone="overdue">Overdue</GroupLabel>
          <ul className="grid gap-2">
            {groups.overdue.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                tone="overdue"
                meta={`Due ${format(new Date(todo.dueDate), "MMM d")}`}
                onToggle={toggle}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {groups.dueToday.length > 0 ? (
        <div className="grid gap-2">
          <GroupLabel>Due today</GroupLabel>
          <ul className="grid gap-2">
            {groups.dueToday.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggle} />
            ))}
          </ul>
        </div>
      ) : null}

      {groups.nextUp.length > 0 ? (
        <div className="grid gap-2">
          <GroupLabel>Next up</GroupLabel>
          <ul className="grid gap-2">
            {groups.nextUp.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggle} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
