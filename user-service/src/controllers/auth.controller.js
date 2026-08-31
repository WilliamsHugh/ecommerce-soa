import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { publicUser, userStore } from "../stores/user.store.js";
import {
  blacklistAccessToken,
  consumeRefreshToken,
  issueTokens,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  verifyRefreshToken,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "../services/token.service.js";
import { audit } from "../services/audit.service.js";
import { env } from "../config/env.js";

export async function register(req, res, next) {
  try {
    const { email, username, password } = req.validated.body;
    if ((await userStore.findByEmail(email)) || (await userStore.findByUsername(username))) {
      return res.status(409).json({ error: "Email or username already exists" });
    }
    const user = await userStore.create({
      id: randomUUID(),
      email,
      username,
      password_hash: await bcrypt.hash(password, 12),
      roles: ["BUYER"],
      status: "ACTIVE",
    });
    await audit({ actorUserId: user.id, action: "USER_REGISTERED", targetId: user.id, req });
    res.status(201).json({ data: publicUser(user), ...(await issueTokens(user)) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email or username already exists" });
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.validated.body;
    const user = await userStore.findByEmail(email);
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({ error: "Invalid credentials or inactive account" });
    }
    await audit({ actorUserId: user.id, action: "USER_LOGGED_IN", targetId: user.id, req });
    res.json({ data: publicUser(user), ...(await issueTokens(user)) });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res) {
  try {
    const payload = verifyRefreshToken(req.validated.body.refresh_token);
    if (!(await consumeRefreshToken(payload))) throw new Error();
    const user = await userStore.findById(payload.sub);
    if (!user || user.status !== "ACTIVE") throw new Error();
    res.json({ data: publicUser(user), ...(await issueTokens(user)) });
  } catch {
    res.status(401).json({ error: "Invalid, expired or reused refresh token" });
  }
}

export async function logout(req, res, next) {
  try {
    await blacklistAccessToken(req.auth);
    if (req.validated.body.refresh_token) {
      await revokeRefreshToken(req.validated.body.refresh_token);
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function logoutAll(req, res, next) {
  try {
    await blacklistAccessToken(req.auth);
    await userStore.incrementTokenVersion(req.auth.sub);
    await revokeAllRefreshTokens(req.auth.sub);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const user = await userStore.findById(req.auth.sub);
    const { current_password: currentPassword, new_password: newPassword } = req.validated.body;
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: "New password must be different" });
    }
    await userStore.update(user.id, { password_hash: await bcrypt.hash(newPassword, 12) });
    await userStore.incrementTokenVersion(user.id);
    await revokeAllRefreshTokens(user.id);
    await audit({ actorUserId: user.id, action: "PASSWORD_CHANGED", targetId: user.id, req });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const user = await userStore.findByEmail(req.validated.body.email);
    let resetToken;
    if (user?.status === "ACTIVE") {
      resetToken = await createPasswordResetToken(user.id);
      await audit({
        actorUserId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        targetId: user.id,
        req,
      });
    }
    const response = { message: "If the account exists, password reset instructions were created" };
    if (resetToken && env.nodeEnv !== "production") response.reset_token = resetToken;
    res.status(202).json(response);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const userId = await consumePasswordResetToken(req.validated.body.reset_token);
    const user = userId ? await userStore.findById(userId) : null;
    if (!user || user.status !== "ACTIVE")
      return res.status(400).json({ error: "Invalid or expired reset token" });
    await userStore.update(user.id, {
      password_hash: await bcrypt.hash(req.validated.body.new_password, 12),
    });
    await userStore.incrementTokenVersion(user.id);
    await revokeAllRefreshTokens(user.id);
    await audit({ actorUserId: user.id, action: "PASSWORD_RESET", targetId: user.id, req });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
