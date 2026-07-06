import { ListTodo } from "lucide-react";

export function TodoEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <ListTodo className="size-6" />
      </div>
      <p className="font-medium">
        {filtered ? "Nothing here" : "No tasks yet"}
      </p>
      <p className="text-muted-foreground max-w-xs text-sm">
        {filtered
          ? "No tasks match this filter. Try another category."
          : "Add your first task with the box above 👆"}
      </p>
    </div>
  );
}
