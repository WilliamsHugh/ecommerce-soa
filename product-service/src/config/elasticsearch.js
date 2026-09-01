import { env } from "./env.js";

const url = new URL(env.elasticsearchUrl);
const username = env.elasticsearchUsername || decodeURIComponent(url.username);
const password = env.elasticsearchPassword || decodeURIComponent(url.password);

// Node's fetch rejects URLs containing embedded credentials. Bonsai provides
// credentials in its cluster URL, so move them into the Authorization header.
url.username = "";
url.password = "";

export const elasticsearchBaseUrl = url.toString().replace(/\/$/, "");
export const elasticsearchHeaders = username
  ? { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` }
  : {};
