import { mongoClient, getMongoCollections } from "../config/mongodb.js";

const publicDocument = (document) => {
  if (!document) return document;
  const { _id, sku_normalized, ...value } = document;
  return value;
};

const unavailable = new Error("INVENTORY_UNAVAILABLE");

export const mongodbProductStore = {
  async all() {
    const { products } = await getMongoCollections();
    return (await products.find({}).toArray()).map(publicDocument);
  },
  async find(id) {
    const { products } = await getMongoCollections();
    return publicDocument(await products.findOne({ id }));
  },
  async save(product) {
    const { products } = await getMongoCollections();
    await products.insertOne({ ...product, sku_normalized: product.sku.toLowerCase() });
    return product;
  },
  async update(product) {
    const { products } = await getMongoCollections();
    await products.replaceOne(
      { id: product.id },
      { ...product, sku_normalized: product.sku.toLowerCase() },
    );
    return product;
  },
  async remove(id) {
    const { products } = await getMongoCollections();
    const result = await products.updateOne(
      { id },
      {
        $set: { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        $unset: { sku_normalized: "" },
      },
    );
    return result.matchedCount > 0;
  },
};

export const mongodbReservationStore = {
  async find(id) {
    const { reservations } = await getMongoCollections();
    return publicDocument(await reservations.findOne({ id }));
  },
  async reserve(reservation) {
    const { products, reservations } = await getMongoCollections();
    const requested = new Map();
    for (const item of reservation.items)
      requested.set(item.product_id, (requested.get(item.product_id) || 0) + item.quantity);
    const items = [...requested.entries()].map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));
    const session = mongoClient.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of items) {
          const result = await products.updateOne(
            {
              id: item.product_id,
              deleted_at: { $exists: false },
              $expr: {
                $gte: [{ $subtract: ["$stock", "$reserved_stock"] }, item.quantity],
              },
            },
            {
              $inc: { reserved_stock: item.quantity },
              $set: { updated_at: new Date().toISOString() },
            },
            { session },
          );
          if (!result.matchedCount) throw unavailable;
        }
        await reservations.insertOne({ ...reservation, items }, { session });
      });
      return { ...reservation, items };
    } catch (error) {
      if (error === unavailable) return null;
      throw error;
    } finally {
      await session.endSession();
    }
  },
  async release(id) {
    const { products, reservations } = await getMongoCollections();
    const session = mongoClient.startSession();
    let released;
    try {
      await session.withTransaction(async () => {
        const reservation = await reservations.findOne({ id, status: "RESERVED" }, { session });
        if (!reservation) return;
        const releasedAt = new Date().toISOString();
        const claimed = await reservations.updateOne(
          { id, status: "RESERVED" },
          { $set: { status: "RELEASED", released_at: releasedAt } },
          { session },
        );
        if (!claimed.modifiedCount) return;
        for (const item of reservation.items) {
          await products.updateOne(
            { id: item.product_id },
            {
              $inc: { reserved_stock: -item.quantity },
              $set: { updated_at: releasedAt },
            },
            { session },
          );
        }
        released = publicDocument({ ...reservation, status: "RELEASED", released_at: releasedAt });
      });
      return released || null;
    } finally {
      await session.endSession();
    }
  },
};
