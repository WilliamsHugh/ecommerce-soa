import { z } from "zod";

const envelope = (body) => z.object({ body, params: z.any(), query: z.any() });
export const registerSchema = envelope(
  z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .max(255)
        .transform((value) => value.toLowerCase()),
      username: z
        .string()
        .trim()
        .min(3)
        .max(100)
        .regex(/^[a-zA-Z0-9_.-]+$/),
      password: z.string().min(8).max(72),
    })
    .strict(),
);
export const loginSchema = envelope(
  z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .transform((value) => value.toLowerCase()),
      password: z.string().min(1).max(72),
    })
    .strict(),
);
export const refreshSchema = envelope(z.object({ refresh_token: z.string().min(1) }).strict());
export const logoutSchema = envelope(
  z.object({ refresh_token: z.string().min(1).optional() }).strict(),
);
const password = z.string().min(8).max(72);
export const changePasswordSchema = envelope(
  z.object({ current_password: z.string().min(1).max(72), new_password: password }).strict(),
);
export const forgotPasswordSchema = envelope(
  z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .transform((value) => value.toLowerCase()),
    })
    .strict(),
);
export const resetPasswordSchema = envelope(
  z.object({ reset_token: z.string().uuid(), new_password: password }).strict(),
);
