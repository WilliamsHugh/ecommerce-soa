import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
});
let initialized;

async function ensureSchema() {
  initialized ||= pool.query(`CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY, user_id VARCHAR(255) NOT NULL, status VARCHAR(32) NOT NULL,
    total NUMERIC(20,2) NOT NULL, currency VARCHAR(3) NOT NULL, items JSONB NOT NULL,
    reservation_id UUID, payment_id VARCHAR(255), shipping_address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, idempotency_key VARCHAR(255)
  )`);
  await initialized;
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)");
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS orders_user_idempotency_key ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL",
  );
}
const fromRow = (row) => ({
  ...row,
  user_id: row.user_id,
  reservation_id: row.reservation_id,
  payment_id: row.payment_id,
  total: Number(row.total),
  items: row.items,
  shipping_address: row.shipping_address,
  created_at: new Date(row.created_at).toISOString(),
  updated_at: new Date(row.updated_at).toISOString(),
});

export const postgresOrderStore = {
  async check() {
    await pool.query("SELECT 1");
    return true;
  },
  async all(userId) {
    await ensureSchema();
    const result = await pool.query(
      userId
        ? "SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC"
        : "SELECT * FROM orders ORDER BY created_at DESC",
      userId ? [userId] : [],
    );
    return result.rows.map(fromRow);
  },
  async find(id) {
    await ensureSchema();
    const result = await pool.query("SELECT * FROM orders WHERE id=$1", [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : undefined;
  },
  async byIdempotency(key, userId) {
    await ensureSchema();
    const result = await pool.query(
      "SELECT * FROM orders WHERE idempotency_key=$1 AND user_id=$2",
      [key, userId],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : undefined;
  },
  async save(order) {
    await ensureSchema();
    await pool.query(
      `INSERT INTO orders (id,user_id,status,total,currency,items,reservation_id,payment_id,shipping_address,created_at,updated_at,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,total=EXCLUDED.total,items=EXCLUDED.items,reservation_id=EXCLUDED.reservation_id,payment_id=EXCLUDED.payment_id,shipping_address=EXCLUDED.shipping_address,updated_at=EXCLUDED.updated_at,idempotency_key=EXCLUDED.idempotency_key`,
      [
        order.id,
        order.user_id,
        order.status,
        order.total,
        order.currency,
        JSON.stringify(order.items),
        order.reservation_id || null,
        order.payment_id || null,
        order.shipping_address,
        order.created_at,
        order.updated_at,
        order.idempotency_key || null,
      ],
    );
    return order;
  },
  async clear() {
    await ensureSchema();
    await pool.query("TRUNCATE orders");
  },
  async close() {
    await pool.end();
  },
};
