import { z } from "zod";

const envelope = (body, params = z.any()) => z.object({ body, params, query: z.any() });
const idParams = z.object({ id: z.string().uuid() });
export const updateMeSchema = envelope(
  z
    .object({
      username: z
        .string()
        .trim()
        .min(3)
        .max(100)
        .regex(/^[a-zA-Z0-9_.-]+$/),
    })
    .strict(),
);
export const updateUserSchema = envelope(
  z
    .object({
      username: z
        .string()
        .trim()
        .min(3)
        .max(100)
        .regex(/^[a-zA-Z0-9_.-]+$/)
        .optional(),
      status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
  idParams,
);
export const idSchema = envelope(z.any(), idParams);
export const roleSchema = envelope(
  z.object({ role: z.enum(["BUYER", "SELLER", "ADMIN"]) }).strict(),
  idParams,
);
export const listUsersSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
    role: z.enum(["BUYER", "SELLER", "ADMIN"]).optional(),
    search: z.string().trim().max(255).optional(),
  }),
});
export const auditListSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    actor_user_id: z.string().uuid().optional(),
    action: z.string().trim().max(100).optional(),
  }),
});
