import { pool } from "../config/database.js";

const memoryAuditLogs = [];

export async function audit({ actorUserId, action, targetId, req, metadata }) {
  const entry = {
    actor_user_id: actorUserId || null,
    action,
    target_id: targetId || null,
    ip_address: req?.ip || null,
    user_agent: req?.get?.("user-agent")?.slice(0, 500) || null,
    metadata: metadata || null,
    created_at: new Date().toISOString(),
  };
  if (!pool) {
    memoryAuditLogs.push(entry);
    return;
  }
  await pool.execute(
    `INSERT INTO audit_logs
      (actor_user_id, action, target_id, ip_address, user_agent, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.actor_user_id,
      action,
      entry.target_id,
      entry.ip_address,
      entry.user_agent,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ],
  );
}

export async function listAuditLogs({ page, limit, actorUserId, action }) {
  if (!pool) {
    let logs = [...memoryAuditLogs].reverse();
    if (actorUserId) logs = logs.filter((log) => log.actor_user_id === actorUserId);
    if (action) logs = logs.filter((log) => log.action === action);
    return { logs: logs.slice((page - 1) * limit, page * limit), total: logs.length };
  }
  const where = [];
  const params = [];
  if (actorUserId) {
    where.push("actor_user_id = ?");
    params.push(actorUserId);
  }
  if (action) {
    where.push("action = ?");
    params.push(action);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [counts] = await pool.execute(`SELECT COUNT(*) total FROM audit_logs ${clause}`, params);
  const [logs] = await pool.execute(
    `SELECT * FROM audit_logs ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String((page - 1) * limit)],
  );
  return { logs, total: Number(counts[0].total) };
}
