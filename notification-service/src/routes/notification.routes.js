import { Router } from "express";
import {
  listNotifications,
  markRead,
  receiveEvent,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  eventSchema,
  notificationIdSchema,
} from "../validation/notification.schemas.js";
import { validate } from "../middlewares/validation.middleware.js";
import { authenticateInternal } from "../middlewares/auth.middleware.js";

const router = Router();
router.post(
  "/events",
  authenticateInternal,
  validate(eventSchema),
  receiveEvent,
);
router.use(authenticate);
router.get("/notifications", listNotifications);
router.post(
  "/notifications/:id/read",
  validate(notificationIdSchema, "params"),
  markRead,
);
export default router;
