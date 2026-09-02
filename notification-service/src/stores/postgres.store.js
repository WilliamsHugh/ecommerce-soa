import pg from "pg";
import { env } from "../config/env.js";

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
});
let initialized;
async function ensureSchema() {
  initialized ||= pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY, event_id VARCHAR(255), event_type VARCHAR(64) NOT NULL,
    recipient VARCHAR(255) NOT NULL, channel VARCHAR(16) NOT NULL, message TEXT NOT NULL,
    status VARCHAR(16) NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ, read_at TIMESTAMPTZ
  )`);
  await initialized;
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_recipient ON notifications(event_id, recipient) WHERE event_id IS NOT NULL",
  );
}
const map = (row) => ({
  ...row,
  payload: row.payload,
  created_at: new Date(row.created_at).toISOString(),
  sent_at: row.sent_at ? new Date(row.sent_at).toISOString() : null,
  read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
});
export const postgresNotificationStore = {
  async check() {
    await pool.query("SELECT 1");
    return true;
  },
  async add(item) {
    await ensureSchema();
    const result = await pool.query(
      `INSERT INTO notifications (id,event_id,event_type,recipient,channel,message,status,payload,created_at,sent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING *`,
      [
        item.id,
        item.event_id || null,
        item.event_type,
        item.recipient,
        item.channel,
        item.message,
        item.status,
        JSON.stringify(item.payload || {}),
        item.created_at,
        item.sent_at || null,
      ],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  },
  async findByRecipient(recipient) {
    await ensureSchema();
    const result = await pool.query(
      recipient
        ? "SELECT * FROM notifications WHERE recipient=$1 ORDER BY created_at DESC"
        : "SELECT * FROM notifications ORDER BY created_at DESC",
      recipient ? [recipient] : [],
    );
    return result.rows.map(map);
  },
  async markRead(id, recipient) {
    await ensureSchema();
    const result = await pool.query(
      "UPDATE notifications SET status='READ', read_at=NOW() WHERE id=$1 AND recipient=$2 RETURNING *",
      [id, recipient],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  },
  async updateStatus(id, status) {
    await ensureSchema();
    await pool.query(
      "UPDATE notifications SET status=$2::varchar, sent_at=CASE WHEN $2::varchar='SENT' THEN NOW() ELSE sent_at END WHERE id=$1",
      [id, status],
    );
  },
};
