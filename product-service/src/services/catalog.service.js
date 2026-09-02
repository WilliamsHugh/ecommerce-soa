import { env } from "../config/env.js";
import { checkMongo } from "../config/mongodb.js";
import { checkImageStorage } from "./image.storage.js";

export async function checkCatalogStore() {
  return env.productStoreDriver === "mongodb" ? checkMongo() : true;
}

export async function checkImageStore() {
  return checkImageStorage();
}
