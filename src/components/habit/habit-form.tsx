"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { HabitWithProgress } from "@/server/services/habit.service";
import { useCreateHabit, useUpdateHabit } from "@/hooks/use-habits";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const SWATCHES = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

const formSchema = z.object({
  name: z.string().trim().min(1, "Name your habit.").max(80),
  targetCount: z
    .string()
    .refine((v) => Number.parseInt(v, 10) >= 1, "Target must be at least 1."),
  unit: z.string().trim().max(24),
  color: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function HabitForm({
  habit,
  open,
  onOpenChange,
}: {
  habit: HabitWithProgress | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = !!habit;
  const create = useCreateHabit();
  const update = useUpdateHabit();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", targetCount: "1", unit: "", color: SWATCHES[0] },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        habit
          ? {
              name: habit.name,
              targetCount: String(habit.targetCount),
              unit: habit.unit ?? "",
              color: habit.color ?? SWATCHES[0],
            }
          : { name: "", targetCount: "1", unit: "", color: SWATCHES[0] },
      );
    }
  }, [habit, open, form]);

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      targetCount: Number.parseInt(values.targetCount, 10),
      unit: values.unit ? values.unit : null,
      color: values.color,
    };
    onOpenChange(false);
    if (isEdit && habit) {
      update.mutate(
        { id: habit.id, patch: payload },
        {
          onError: (e) => toast.error(e.message),
          onSuccess: () => toast.success("Habit updated"),
        },
      );
    } else {
      create.mutate(payload, {
        onError: (e) => toast.error(e.message),
        onSuccess: () => toast.success("Habit added"),
      });
    }
  }

  const color = useWatch({ control: form.control, name: "color" });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit habit" : "New habit"}
      description="Track something with a daily numeric target."
    >
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input maxLength={80} placeholder="Drink water" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="targetCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily target</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="8"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/[^0-9]/g, ""))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit (optional)</FormLabel>
                    <FormControl>
                      <Input maxLength={24} placeholder="glasses" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormItem>
              <FormLabel>Color</FormLabel>
              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`Color ${s}`}
                    aria-pressed={color === s}
                    onClick={() => form.setValue("color", s)}
                    className={cn(
                      "size-7 rounded-full ring-offset-2 ring-offset-background transition",
                      color === s && "ring-ring ring-2",
                    )}
                    style={{ backgroundColor: s }}
                  />
                ))}
              </div>
            </FormItem>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {isEdit ? "Save changes" : "Add habit"}
              </Button>
            </div>
          </form>
        </Form>
    </ResponsiveModal>
  );
}
