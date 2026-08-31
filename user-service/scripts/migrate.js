import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { pool, closeDatabase } from "../src/config/database.js";

if (!pool) throw new Error("Migration requires MySQL; remove USER_STORE_DRIVER=memory");
const connection = await pool.getConnection();
try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  )`);
  const migrationUrl = new URL("../migrations/", import.meta.url);
  const files = (await readdir(migrationUrl)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const [existing] = await connection.execute(
      "SELECT version FROM schema_migrations WHERE version = ?",
      [file],
    );
    if (existing.length) continue;
    let sql = await readFile(new URL(file, migrationUrl), "utf8");
    // MySQL DDL implicitly commits. Make the security migration retryable if a
    // process is interrupted after ALTER TABLE but before schema_migrations.
    if (file === "002_security_and_audit.sql") {
      const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'token_version'");
      if (columns.length) sql = sql.replace(/ALTER TABLE users[\s\S]*?;\s*/i, "");
    }
    await connection.beginTransaction();
    try {
      for (const statement of sql
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)) {
        await connection.query(statement);
      }
      await connection.execute("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
      await connection.commit();
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
  console.log("User Service migration completed");
} finally {
  connection.release();
  await closeDatabase();
}
