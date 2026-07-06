import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Give your task a title.").max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  dueDate: z.number().int().positive().optional().nullable(),
  priority: z.number().int().min(0).max(3).optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1, "Give your task a title.").max(200).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  isDone: z.boolean().optional(),
  dueDate: z.number().int().positive().optional().nullable(),
  priority: z.number().int().min(0).max(3).optional(),
});

export const reorderTodosSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ReorderTodosInput = z.infer<typeof reorderTodosSchema>;
