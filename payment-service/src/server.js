import app from "./app.js";
import { assertProductionConfig, env } from "./config/env.js";
import { startOutboxWorker } from "./services/outbox.service.js";

assertProductionConfig();
startOutboxWorker();
app.listen(env.port, "0.0.0.0", () =>
  console.log(`payment-service listening on ${env.port}`),
);
