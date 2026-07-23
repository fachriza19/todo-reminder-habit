"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";

import type { Reminder } from "@/db/schema";
import {
  useCreateReminder,
  useUpdateReminder,
} from "@/hooks/use-reminders";
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

const INPUT_FMT = "yyyy-MM-dd'T'HH:mm";

function toInputValue(ms: number): string {
  return format(new Date(ms), INPUT_FMT);
}

function defaultRemindAt(): string {
  // Next hour, on the hour — a sensible default.
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return format(d, INPUT_FMT);
}

const formSchema = z.object({
  title: z.string().trim().min(1, "Give your reminder a title.").max(200),
  remindAt: z
    .string()
    .min(1, "Pick a date and time.")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Pick a valid time."),
});
type FormValues = z.infer<typeof formSchema>;

export function ReminderForm({
  reminder,
  open,
  onOpenChange,
}: {
  reminder: Reminder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = !!reminder;
  const create = useCreateReminder();
  const update = useUpdateReminder();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", remindAt: defaultRemindAt() },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        reminder
          ? { title: reminder.title, remindAt: toInputValue(reminder.remindAt) }
          : { title: "", remindAt: defaultRemindAt() },
      );
    }
  }, [reminder, open, form]);

  function onSubmit(values: FormValues) {
    const remindAt = new Date(values.remindAt).getTime();
    onOpenChange(false);
    if (isEdit && reminder) {
      update.mutate(
        { id: reminder.id, patch: { title: values.title, remindAt } },
        {
          onError: (e) => toast.error(e.message),
          onSuccess: () => toast.success("Reminder updated"),
        },
      );
    } else {
      create.mutate(
        { title: values.title, remindAt },
        {
          onError: (e) => toast.error(e.message),
          onSuccess: () => toast.success("Reminder added"),
        },
      );
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit reminder" : "New reminder"}
      description="You’ll see it highlighted here when it’s due."
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
                    <Input maxLength={200} placeholder="Call the dentist" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remindAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>When</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {isEdit ? "Save changes" : "Add reminder"}
              </Button>
            </div>
          </form>
        </Form>
    </ResponsiveModal>
  );
}
