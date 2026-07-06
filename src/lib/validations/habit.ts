import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use a hex color like #4f46e5.");

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.");

export const createHabitSchema = z.object({
  name: z.string().trim().min(1, "Name your habit.").max(80),
  targetCount: z
    .number()
    .int()
    .min(1, "Target must be at least 1.")
    .max(1000),
  unit: z.string().trim().max(24).optional().nullable(),
  color: hexColor.optional().nullable(),
});

export const updateHabitSchema = z.object({
  name: z.string().trim().min(1, "Name your habit.").max(80).optional(),
  targetCount: z.number().int().min(1).max(1000).optional(),
  unit: z.string().trim().max(24).optional().nullable(),
  color: hexColor.optional().nullable(),
  isArchived: z.boolean().optional(),
});

export const logHabitSchema = z.object({
  date: dateString,
  count: z.number().int().min(0).max(100000),
});

export const habitHistoryQuerySchema = z.object({
  from: dateString,
  to: dateString,
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type LogHabitInput = z.infer<typeof logHabitSchema>;
