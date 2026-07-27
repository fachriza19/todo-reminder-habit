import { z } from "zod";

export const CATEGORY_KINDS = ["expense", "income"] as const;
export const CATEGORY_COLORS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

export const createFinanceCategorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name.").max(40),
  kind: z.enum(CATEGORY_KINDS),
  color: z.enum(CATEGORY_COLORS).optional().nullable(),
  icon: z.string().trim().max(4).optional().nullable(),
});

export const updateFinanceCategorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name.").max(40).optional(),
  color: z.enum(CATEGORY_COLORS).optional().nullable(),
  icon: z.string().trim().max(4).optional().nullable(),
  isArchived: z.boolean().optional(),
});

export type CreateFinanceCategoryInput = z.infer<
  typeof createFinanceCategorySchema
>;
export type UpdateFinanceCategoryInput = z.infer<
  typeof updateFinanceCategorySchema
>;
