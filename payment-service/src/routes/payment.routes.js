import { Router } from "express";
import {
  byOrder,
  callback,
  create,
  get,
  refund,
} from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authenticateInternal } from "../middlewares/internal.middleware.js";
import {
  callbackSchema,
  createPaymentSchema,
  orderIdSchema,
  paymentIdSchema,
  refundSchema,
  validate,
} from "../validation/payment.validation.js";
const router = Router();
router.post("/", authenticate, validate(createPaymentSchema), create);
router.post(
  "/callback",
  authenticateInternal,
  validate(callbackSchema),
  callback,
);
router.get(
  "/order/:order_id",
  authenticate,
  validate(orderIdSchema, "params"),
  byOrder,
);
router.get("/:id", authenticate, validate(paymentIdSchema, "params"), get);
router.post(
  "/:id/refund",
  authenticate,
  validate(paymentIdSchema, "params"),
  validate(refundSchema),
  refund,
);
export default router;
