import "dotenv/config";
import app from "./app.js";
import { checkDatabase, closeDatabase } from "./config/database.js";
import { assertProductionSecrets, env } from "./config/env.js";
import { checkRedis, closeRedis } from "./config/redis.js";

assertProductionSecrets();
await Promise.all([checkDatabase(), checkRedis()]);

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`user-service listening on port ${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down user-service`);
  server.close(async () => {
    await Promise.all([closeDatabase(), closeRedis()]);
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
