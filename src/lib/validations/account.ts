import { z } from "zod";

export const ACCOUNT_TYPES = ["cash", "bank", "ewallet", "card"] as const;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name.").max(40),
  type: z.enum(ACCOUNT_TYPES),
  color: z.string().trim().max(20).optional().nullable(),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name.").max(40).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  color: z.string().trim().max(20).optional().nullable(),
  isArchived: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
