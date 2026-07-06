import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use a hex color like #4f46e5.");

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name your category.").max(60),
  color: hexColor.optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Name your category.").max(60).optional(),
  color: hexColor.optional().nullable(),
});

export const reorderCategoriesSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1), sortOrder: z.number().int() }))
    .min(1),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
