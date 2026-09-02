import app from "./app.js";
import { assertProductionConfig, env } from "./config/env.js";

assertProductionConfig();
app.listen(env.port, "0.0.0.0", () =>
  console.log(`api-gateway listening on ${env.port}`),
);
