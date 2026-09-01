import { env } from "../config/env.js";
import { elasticsearchBaseUrl, elasticsearchHeaders } from "../config/elasticsearch.js";

const endpoint = (path = "") =>
  `${elasticsearchBaseUrl}/${env.elasticsearchIndex}${path}`;
const request = async (path, options = {}) => {
  const response = await fetch(endpoint(path), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...elasticsearchHeaders,
      ...(options.headers || {}),
    },
  });
  if (!response.ok)
    throw Object.assign(new Error(`Elasticsearch request failed: ${response.status}`), {
      status: response.status,
    });
  return response.status === 204 ? null : response.json();
};

let indexReady;
async function ensureIndex() {
  if (!indexReady) {
    indexReady = fetch(endpoint(), {
      method: "PUT",
      headers: { "content-type": "application/json", ...elasticsearchHeaders },
      body: JSON.stringify({
        mappings: {
          properties: {
            id: { type: "keyword" },
            sku: { type: "keyword" },
            name: { type: "text" },
            description: { type: "text" },
            price: { type: "double" },
            stock: { type: "integer" },
            reserved_stock: { type: "integer" },
            created_at: { type: "date" },
            updated_at: { type: "date" },
            deleted_at: { type: "date" },
          },
        },
      }),
    }).then(async (response) => {
      if (!response.ok && response.status !== 400)
        throw new Error(`Elasticsearch index initialization failed: ${response.status}`);
      return true;
    });
  }
  return indexReady;
}

export const elasticsearchStore = {
  async all() {
    await ensureIndex();
    const result = await request("/_search", {
      method: "POST",
      body: JSON.stringify({ size: 10_000, query: { match_all: {} } }),
    });
    return result.hits.hits.map((hit) => hit._source);
  },
  async find(id) {
    await ensureIndex();
    try {
      return (await request(`/_doc/${encodeURIComponent(id)}`))._source;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  },
  async save(product) {
    await ensureIndex();
    await request(`/_doc/${encodeURIComponent(product.id)}?refresh=wait_for`, {
      method: "PUT",
      body: JSON.stringify(product),
    });
    return product;
  },
  async update(product) {
    return this.save(product);
  },
  async remove(id) {
    const product = await this.find(id);
    if (!product) return false;
    product.deleted_at = new Date().toISOString();
    await this.save(product);
    return true;
  },
};
