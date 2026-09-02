import { z } from "zod";
const id = z.string().trim().min(1).max(255);
const money = z.number().finite().positive().multipleOf(0.01);
export const paymentIdSchema = z.object({ id: z.uuid() });
export const orderIdSchema = z.object({ order_id: id });
export const createPaymentSchema = z.strictObject({
  order_id: id,
  amount: money,
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .default("VND"),
});
export const refundSchema = z.strictObject({ amount: money.optional() });
export const callbackSchema = z
  .strictObject({
    event_id: id,
    payment_id: z.uuid().optional(),
    gateway_reference: id.optional(),
    status: z.enum(["AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED"]),
  })
  .refine((value) => value.payment_id || value.gateway_reference, {
    message: "payment_id or gateway_reference is required",
  });
export function validate(schema, source = "body") {
  return (req, _res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
