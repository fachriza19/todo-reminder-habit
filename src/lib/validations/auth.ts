import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signupSchema = z.object({
  name: z.string().min(1, "Enter your name.").max(80),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "That password is too long."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
