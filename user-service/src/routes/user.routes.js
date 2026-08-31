import { Router } from "express";
import {
  addRole,
  deleteUser,
  getCurrentUser,
  getUser,
  updateCurrentUser,
  updateUser,
  listUsers,
  removeRole,
  getAuditLogs,
} from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  idSchema,
  roleSchema,
  updateMeSchema,
  updateUserSchema,
  listUsersSchema,
  auditListSchema,
} from "../validation/user.schemas.js";

const router = Router();
router.use(authenticate);
router.get("/me", getCurrentUser);
router.put("/me", validate(updateMeSchema), updateCurrentUser);
router.get("/", authorize("ADMIN"), validate(listUsersSchema), listUsers);
router.get("/audit-logs", authorize("ADMIN"), validate(auditListSchema), getAuditLogs);
router.get("/:id", validate(idSchema), getUser);
router.put("/:id", authorize("ADMIN"), validate(updateUserSchema), updateUser);
router.post("/:id/roles", authorize("ADMIN"), validate(roleSchema), addRole);
router.delete("/:id/roles", authorize("ADMIN"), validate(roleSchema), removeRole);
router.delete("/:id", authorize("ADMIN"), validate(idSchema), deleteUser);
export default router;
