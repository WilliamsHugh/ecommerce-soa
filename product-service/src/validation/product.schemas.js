import { z } from "zod";

const envelope = (body = z.any(), params = z.any(), query = z.any()) =>
  z.object({ body, params, query });
const id = z.object({ id: z.string().uuid() });
const category = z.union([
  z.string().trim().min(1).max(100),
  z.object({ name: z.string().trim().min(1).max(100) }).passthrough(),
]);
export const productInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    sku: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_.-]+$/),
    category,
    price: z.coerce.number().finite().nonnegative(),
    currency: z
      .string()
      .trim()
      .length(3)
      .default("VND")
      .transform((value) => value.toUpperCase()),
    stock: z.coerce.number().int().nonnegative().max(2_000_000_000).default(0),
    images: z.array(z.string().url()).max(20).default([]),
    description: z.string().max(10_000).default(""),
  })
  .strict();
export const createProductSchema = envelope(productInputSchema);
export const updateProductSchema = envelope(
  productInputSchema
    .partial()
    .refine((v) => Object.keys(v).length > 0, "At least one field is required"),
  id,
);
export const idSchema = envelope(z.any(), id);
export const listProductsSchema = envelope(
  z.any(),
  z.any(),
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
      sort: z
        .enum(["created_at", "updated_at", "name", "price", "stock", "available_stock"])
        .default("created_at"),
      order: z.enum(["asc", "desc"]).default("desc"),
      category: z.string().trim().max(100).optional(),
      min_price: z.coerce.number().finite().nonnegative().optional(),
      max_price: z.coerce.number().finite().nonnegative().optional(),
      q: z.string().trim().max(255).optional(),
    })
    .refine(
      (v) => v.min_price === undefined || v.max_price === undefined || v.min_price <= v.max_price,
      "min_price must be <= max_price",
    ),
);
export const searchSchema = envelope(
  z.any(),
  z.any(),
  z.object({
    q: z.string().trim().min(1).max(255),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
);
export const reservationSchema = envelope(
  z
    .object({
      items: z
        .array(
          z
            .object({
              product_id: z.string().uuid(),
              quantity: z.coerce.number().int().min(1).max(1_000),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict(),
);
export const imagePresignSchema = envelope(
  z
    .object({
      filename: z.string().trim().min(1).max(255),
      content_type: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
      size: z.coerce
        .number()
        .int()
        .positive()
        .max(10 * 1024 * 1024),
    })
    .strict(),
  id,
);
