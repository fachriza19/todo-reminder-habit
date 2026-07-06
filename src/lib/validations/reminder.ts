import { z } from "zod";

export const createReminderSchema = z.object({
  title: z.string().trim().min(1, "Give your reminder a title.").max(200),
  remindAt: z.number().int().positive("Pick a date and time."),
});

export const updateReminderSchema = z.object({
  title: z.string().trim().min(1, "Give your reminder a title.").max(200).optional(),
  remindAt: z.number().int().positive().optional(),
  isDone: z.boolean().optional(),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
