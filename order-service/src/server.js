import app from "./app.js";
import { assertProductionConfig, env } from "./config/env.js";

assertProductionConfig();
app.listen(env.port, "0.0.0.0", () =>
  console.log(`order-service listening on ${env.port}`),
);
