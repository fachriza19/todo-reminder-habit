"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import type { Todo, Category } from "@/db/schema";
import { useUpdateTodo } from "@/hooks/use-todos";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_CATEGORY = "__none__";
const PRIORITIES = [
  { value: "0", label: "None" },
  { value: "1", label: "Low" },
  { value: "2", label: "Medium" },
  { value: "3", label: "High" },
];

const formSchema = z.object({
  title: z.string().trim().min(1, "Give your task a title.").max(200),
  notes: z.string().trim().max(2000),
  categoryId: z.string(),
  priority: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function TodoForm({
  todo,
  categories,
  open,
  onOpenChange,
}: {
  todo: Todo | null;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateTodo();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", notes: "", categoryId: NO_CATEGORY, priority: "0" },
  });

  useEffect(() => {
    if (todo) {
      form.reset({
        title: todo.title,
        notes: todo.notes ?? "",
        categoryId: todo.categoryId ?? NO_CATEGORY,
        priority: String(todo.priority),
      });
    }
  }, [todo, form]);

  function onSubmit(values: FormValues) {
    if (!todo) return;
    onOpenChange(false);
    update.mutate(
      {
        id: todo.id,
        patch: {
          title: values.title,
          notes: values.notes ? values.notes : null,
          categoryId:
            values.categoryId === NO_CATEGORY ? null : values.categoryId,
          priority: Number(values.priority),
        },
      },
      {
        onError: (e) => toast.error(e.message),
        onSuccess: () => toast.success("Task updated"),
      },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit task"
      description="Update the details of this task."
    >
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="What needs doing?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Optional details" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>Uncategorized</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </Form>
    </ResponsiveModal>
  );
}
