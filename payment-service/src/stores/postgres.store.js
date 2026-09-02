import pg from "pg";
import { env } from "../config/env.js";
const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
});
let initialized;
async function ensureSchema() {
  initialized ||= pool.query(`CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY, user_id VARCHAR(255) NOT NULL, order_id VARCHAR(255) NOT NULL,
    amount NUMERIC(20,2) NOT NULL, currency CHAR(3) NOT NULL, status VARCHAR(32) NOT NULL,
    gateway VARCHAR(64) NOT NULL, gateway_reference VARCHAR(255) UNIQUE NOT NULL,
    idempotency_key VARCHAR(255), refund_amount NUMERIC(20,2), history JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(user_id, order_id, idempotency_key));
    CREATE TABLE IF NOT EXISTS payment_webhook_events (event_id VARCHAR(255) PRIMARY KEY, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  await initialized;
  await pool.query(`CREATE TABLE IF NOT EXISTS payment_outbox (
    id VARCHAR(255) PRIMARY KEY, type VARCHAR(64) NOT NULL, payload JSONB NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
const fromRow = (row) =>
  row && {
    ...row,
    amount: Number(row.amount),
    refund_amount:
      row.refund_amount == null ? undefined : Number(row.refund_amount),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
export const postgresPaymentStore = {
  async check() {
    await pool.query("SELECT 1");
    return true;
  },
  async find(id) {
    await ensureSchema();
    return fromRow(
      (await pool.query("SELECT * FROM payments WHERE id=$1", [id])).rows[0],
    );
  },
  async findByGatewayReference(ref) {
    await ensureSchema();
    return fromRow(
      (
        await pool.query("SELECT * FROM payments WHERE gateway_reference=$1", [
          ref,
        ])
      ).rows[0],
    );
  },
  async findByOrder(orderId, userId) {
    await ensureSchema();
    const values = [orderId];
    let sql = "SELECT * FROM payments WHERE order_id=$1";
    if (userId) {
      sql += " AND user_id=$2";
      values.push(userId);
    }
    sql += " ORDER BY created_at DESC";
    return (await pool.query(sql, values)).rows.map(fromRow);
  },
  async findByKey(key, userId, orderId) {
    await ensureSchema();
    return fromRow(
      (
        await pool.query(
          "SELECT * FROM payments WHERE idempotency_key=$1 AND user_id=$2 AND order_id=$3",
          [key, userId, orderId],
        )
      ).rows[0],
    );
  },
  async save(p) {
    await ensureSchema();
    await pool.query(
      `INSERT INTO payments (id,user_id,order_id,amount,currency,status,gateway,gateway_reference,idempotency_key,refund_amount,history,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,refund_amount=EXCLUDED.refund_amount,history=EXCLUDED.history,updated_at=EXCLUDED.updated_at`,
      [
        p.id,
        p.user_id,
        p.order_id,
        p.amount,
        p.currency,
        p.status,
        p.gateway,
        p.gateway_reference,
        p.idempotency_key || null,
        p.refund_amount || null,
        JSON.stringify(p.history),
        p.created_at,
        p.updated_at,
      ],
    );
    return p;
  },
  async saveWithOutbox(p, message) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE payments SET status=$2,history=$3,updated_at=$4 WHERE id=$1",
        [p.id, p.status, JSON.stringify(p.history), p.updated_at],
      );
      await client.query(
        "INSERT INTO payment_outbox(id,type,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [message.id, message.type, JSON.stringify(message.payload)],
      );
      await client.query("COMMIT");
      return p;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async pendingOutbox(limit = 20) {
    await ensureSchema();
    return (
      await pool.query(
        "SELECT * FROM payment_outbox WHERE available_at <= NOW() ORDER BY created_at LIMIT $1",
        [limit],
      )
    ).rows;
  },
  async completeOutbox(id) {
    await ensureSchema();
    await pool.query("DELETE FROM payment_outbox WHERE id=$1", [id]);
  },
  async retryOutbox(id, reason) {
    await ensureSchema();
    await pool.query(
      "UPDATE payment_outbox SET attempts=attempts+1,last_error=$2,available_at=NOW() + LEAST(60, POWER(2, attempts+1)) * INTERVAL '1 second' WHERE id=$1",
      [id, reason],
    );
  },
  async claimEvent(eventId) {
    await ensureSchema();
    return (
      (
        await pool.query(
          "INSERT INTO payment_webhook_events(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id",
          [eventId],
        )
      ).rowCount === 1
    );
  },
  async applyCallback(payment, eventId, message) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const claimed = await client.query(
        "INSERT INTO payment_webhook_events(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id",
        [eventId],
      );
      if (!claimed.rowCount) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        "UPDATE payments SET status=$2,history=$3,updated_at=$4 WHERE id=$1",
        [
          payment.id,
          payment.status,
          JSON.stringify(payment.history),
          payment.updated_at,
        ],
      );
      if (message)
        await client.query(
          "INSERT INTO payment_outbox(id,type,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [message.id, message.type, JSON.stringify(message.payload)],
        );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async clear() {
    await ensureSchema();
    await pool.query(
      "TRUNCATE payments, payment_webhook_events, payment_outbox",
    );
  },
  async close() {
    await pool.end();
  },
};
