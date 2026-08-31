import { revokeAllRefreshTokens } from "../services/token.service.js";
import { publicUser, userStore } from "../stores/user.store.js";
import { audit, listAuditLogs } from "../services/audit.service.js";

export async function listUsers(req, res, next) {
  try {
    const { users, total } = await userStore.list(req.validated.query);
    const { page, limit } = req.validated.query;
    res.json({
      data: users.map(publicUser),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(req, res, next) {
  try {
    const user = await userStore.findById(req.auth.sub);
    return user
      ? res.json({ data: publicUser(user) })
      : res.status(404).json({ error: "User not found" });
  } catch (error) {
    next(error);
  }
}

export async function updateCurrentUser(req, res, next) {
  try {
    const user = await userStore.update(req.auth.sub, req.validated.body);
    return user
      ? res.json({ data: publicUser(user) })
      : res.status(404).json({ error: "User not found" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Username exists" });
    next(error);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await userStore.findById(req.validated.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (req.auth.sub !== user.id && !req.auth.roles.includes("ADMIN")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    res.json({ data: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await userStore.update(req.validated.params.id, req.validated.body);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (req.validated.body.status && req.validated.body.status !== "ACTIVE") {
      await userStore.incrementTokenVersion(user.id);
      await revokeAllRefreshTokens(user.id);
    }
    await audit({
      actorUserId: req.auth.sub,
      action: "USER_UPDATED",
      targetId: user.id,
      req,
      metadata: req.validated.body,
    });
    res.json({ data: publicUser(user) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Username exists" });
    next(error);
  }
}

export async function addRole(req, res, next) {
  try {
    const user = await userStore.addRole(req.validated.params.id, req.validated.body.role);
    if (!user) return res.status(404).json({ error: "User not found" });
    await userStore.incrementTokenVersion(user.id);
    await revokeAllRefreshTokens(user.id);
    await audit({
      actorUserId: req.auth.sub,
      action: "ROLE_ADDED",
      targetId: user.id,
      req,
      metadata: req.validated.body,
    });
    return res.status(201).json({ data: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function removeRole(req, res, next) {
  try {
    const { id } = req.validated.params;
    const { role } = req.validated.body;
    const current = await userStore.findById(id);
    if (!current) return res.status(404).json({ error: "User not found" });
    if (current.roles.length === 1 && current.roles.includes(role)) {
      return res.status(409).json({ error: "A user must have at least one role" });
    }
    const user = await userStore.removeRole(id, role);
    await userStore.incrementTokenVersion(id);
    await revokeAllRefreshTokens(id);
    await audit({
      actorUserId: req.auth.sub,
      action: "ROLE_REMOVED",
      targetId: id,
      req,
      metadata: { role },
    });
    res.json({ data: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const id = req.validated.params.id;
    if (id === req.auth.sub)
      return res.status(409).json({ error: "Admin cannot delete the current account" });
    if (!(await userStore.delete(id))) return res.status(404).json({ error: "User not found" });
    await revokeAllRefreshTokens(id);
    await audit({ actorUserId: req.auth.sub, action: "USER_DELETED", targetId: id, req });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const { logs, total } = await listAuditLogs(req.validated.query);
    const { page, limit } = req.validated.query;
    res.json({ data: logs, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}
