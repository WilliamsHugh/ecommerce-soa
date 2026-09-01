import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  searchProducts,
  updateProduct,
} from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createProductSchema,
  idSchema,
  listProductsSchema,
  searchSchema,
  updateProductSchema,
} from "../validation/product.schemas.js";

const router = Router();
router.get("/search", validate(searchSchema), searchProducts);
router.get("/", validate(listProductsSchema), listProducts);
router.get("/:id", validate(idSchema), getProduct);
router.post("/", authenticate(["SELLER", "ADMIN"]), validate(createProductSchema), createProduct);
router.put("/:id", authenticate(["SELLER", "ADMIN"]), validate(updateProductSchema), updateProduct);
router.delete("/:id", authenticate(["SELLER", "ADMIN"]), validate(idSchema), deleteProduct);
export default router;
