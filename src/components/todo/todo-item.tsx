"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Todo, Category } from "@/db/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/common/truncated-text";

const PRIORITY_LABEL = ["None", "Low", "Medium", "High"];

export function TodoItem({
  todo,
  category,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  category?: Category;
  onToggleDone: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const done = todo.isDone === 1;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group bg-card animate-in fade-in-0 flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 duration-200",
        isDragging && "z-10 opacity-80 shadow-md",
      )}
    >
      <button
        type="button"
        aria-label="Reorder task"
        className="text-muted-foreground/50 hover:text-foreground flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <Checkbox
        checked={done}
        onCheckedChange={() => onToggleDone(todo)}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        className="size-6"
      />

      <button
        type="button"
        onClick={() => onEdit(todo)}
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
      >
        <TruncatedText
          text={todo.title}
          className={cn(
            "text-sm",
            done && "text-muted-foreground line-through",
          )}
        />
        {todo.priority >= 2 && !done ? (
          <Flag
            className={cn(
              "size-3.5 shrink-0",
              todo.priority === 3 ? "text-destructive" : "text-warning",
            )}
            aria-label={`${PRIORITY_LABEL[todo.priority]} priority`}
          />
        ) : null}
      </button>

      {category ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: category.color ?? "var(--muted-foreground)" }}
            aria-hidden
          />
          <TruncatedText
            text={category.name}
            className="text-muted-foreground hidden max-w-24 text-xs sm:block"
          />
        </span>
      ) : null}

      <div className="row-actions flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label="Edit task"
          onClick={() => onEdit(todo)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-10"
          aria-label="Delete task"
          onClick={() => onDelete(todo)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
