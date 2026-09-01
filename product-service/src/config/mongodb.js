import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const mongoClient =
  env.productStoreDriver === "mongodb"
    ? new MongoClient(env.mongodbUri, {
        serverSelectionTimeoutMS: env.mongodbConnectionTimeoutMs,
        connectTimeoutMS: env.mongodbConnectionTimeoutMs,
      })
    : null;

let collectionsPromise;

export async function getMongoCollections() {
  if (!mongoClient) throw new Error("MongoDB store is not enabled");
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      await mongoClient.connect();
      const database = mongoClient.db(env.mongodbDatabase);
      const products = database.collection(env.mongodbProductsCollection);
      const reservations = database.collection(env.mongodbReservationsCollection);
      await Promise.all([
        products.createIndex({ id: 1 }, { unique: true }),
        products.createIndex({ sku_normalized: 1 }, { unique: true, sparse: true }),
        products.createIndex({ name: "text", description: "text", "category.name": "text" }),
        reservations.createIndex({ id: 1 }, { unique: true }),
        reservations.createIndex({ user_id: 1, status: 1 }),
      ]);
      return { database, products, reservations };
    })().catch((error) => {
      collectionsPromise = undefined;
      throw error;
    });
  }
  return collectionsPromise;
}

export async function checkMongo() {
  if (!mongoClient) return true;
  const { database } = await getMongoCollections();
  await database.command({ ping: 1 });
  return true;
}

export async function closeMongo() {
  if (mongoClient) await mongoClient.close();
  collectionsPromise = undefined;
}
