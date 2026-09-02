import "dotenv/config";
import app from "./app.js";
import { assertProductionConfig, env } from "./config/env.js";
import { checkMongo, closeMongo } from "./config/mongodb.js";

assertProductionConfig();
await checkMongo();
const port = env.port;
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`product-service listening on ${port}`),
);

async function shutdown(signal) {
  console.log(`${signal} received, shutting down product-service`);
  server.close(async () => {
    await closeMongo();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
