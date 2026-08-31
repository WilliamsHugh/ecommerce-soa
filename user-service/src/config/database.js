import mysql from "mysql2/promise";
import { env } from "./env.js";

export const pool = env.useMemoryStores
  ? null
  : mysql.createPool({
      ...env.mysql,
      waitForConnections: true,
      queueLimit: 0,
      timezone: "Z",
    });

export async function checkDatabase() {
  if (!pool) return true;
  await pool.query("SELECT 1");
  return true;
}

export async function closeDatabase() {
  await pool?.end();
}
