import { Router } from "express";
import { presignImage } from "../controllers/image.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { imagePresignSchema } from "../validation/product.schemas.js";

const router = Router();
router.post(
  "/:id/images/presign",
  authenticate(["SELLER", "ADMIN"]),
  validate(imagePresignSchema),
  presignImage,
);
export default router;
