import { z } from "zod";
import { MAX_AMOUNT_MINOR } from "@/lib/money";

export const TRANSACTION_TYPES = ["expense", "income"] as const;

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");

export const createTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amountMinor: z
    .number()
    .int("Enter a whole amount.")
    .positive("Enter an amount.")
    .max(MAX_AMOUNT_MINOR, "That amount is too large."),
  categoryId: z.string().min(1).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  occurredOn: localDate,
  note: z.string().trim().max(200).optional().nullable(),
});

export const updateTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES).optional(),
  amountMinor: z
    .number()
    .int("Enter a whole amount.")
    .positive("Enter an amount.")
    .max(MAX_AMOUNT_MINOR, "That amount is too large.")
    .optional(),
  categoryId: z.string().min(1).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  occurredOn: localDate.optional(),
  note: z.string().trim().max(200).optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
