import app from "./app.js";
import { assertProductionConfig, env } from "./config/env.js";

assertProductionConfig();
const port = env.port;
app.listen(port, "0.0.0.0", () => console.log(`product-service listening on ${port}`));
