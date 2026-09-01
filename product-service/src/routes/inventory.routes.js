import { Router } from "express";
import { releaseInventory, reserveInventory } from "../controllers/inventory.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { idSchema, reservationSchema } from "../validation/product.schemas.js";

const router = Router();
router.post("/reserve", authenticate(), validate(reservationSchema), reserveInventory);
router.post("/reservations/:id/release", authenticate(), validate(idSchema), releaseInventory);
export default router;
