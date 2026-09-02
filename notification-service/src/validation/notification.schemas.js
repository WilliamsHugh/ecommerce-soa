import { z } from "zod";

export const eventSchema = z.object({
  event_id: z.string().min(1).max(255).optional(),
  type: z.enum([
    "OrderCreated",
    "PaymentSuccess",
    "OrderConfirmed",
    "OrderShipped",
    "OrderDelivered",
    "LowStock",
  ]),
  data: z.record(z.string(), z.unknown()).default({}),
  occurred_at: z.string().datetime().optional(),
});

export const recipientSchema = z.string().min(1).max(255);
