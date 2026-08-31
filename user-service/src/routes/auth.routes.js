import { Router } from "express";
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  resetPassword,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validation/auth.schemas.js";
import { loginRateLimit } from "../middlewares/rate-limit.middleware.js";

const router = Router();
router.post("/register", validate(registerSchema), register);
router.post("/login", loginRateLimit, validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);
router.post("/logout", authenticate, validate(logoutSchema), logout);
router.post("/logout-all", authenticate, validate(logoutSchema), logoutAll);
router.post("/change-password", authenticate, validate(changePasswordSchema), changePassword);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
export default router;
