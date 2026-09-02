import { randomUUID } from "node:crypto";
import { productStore } from "../stores/product.store.js";

const serialize = (product) => ({
  ...product,
  available_stock: product.stock - product.reserved_stock,
});
const categoryName = (product) =>
  typeof product.category === "string" ? product.category : product.category?.name || "";
const publicProducts = (products) =>
  products.filter((product) => !product.deleted_at).map(serialize);
const aggregations = (products) => ({
  categories: Object.entries(
    products.reduce((counts, product) => {
      const name = categoryName(product);
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {}),
  ).map(([key, count]) => ({ key, count })),
  price: products.length
    ? {
        min: Math.min(...products.map((product) => product.price)),
        max: Math.max(...products.map((product) => product.price)),
      }
    : { min: null, max: null },
});

export async function searchProducts(req, res, next) {
  try {
    const { q, page, limit } = req.validated.query;
    const needle = q.toLowerCase();
    const matches = (await productStore.all()).filter(
      (product) =>
        !product.deleted_at &&
        `${product.name} ${product.description} ${categoryName(product)}`
          .toLowerCase()
          .includes(needle),
    );
    const total = matches.length;
    res.json({
      data: publicProducts(matches).slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      aggregations: aggregations(matches),
    });
  } catch (error) {
    next(error);
  }
}

export async function listProducts(req, res, next) {
  try {
    const {
      category,
      min_price: minPrice,
      max_price: maxPrice,
      sort,
      order,
      page,
      limit,
      q,
    } = req.validated.query;
    let products = (await productStore.all()).filter((product) => !product.deleted_at);
    if (q) {
      const needle = q.toLowerCase();
      products = products.filter((p) =>
        `${p.name} ${p.description}`.toLowerCase().includes(needle),
      );
    }
    if (category)
      products = products.filter((p) => categoryName(p).toLowerCase() === category.toLowerCase());
    if (minPrice !== undefined) products = products.filter((p) => p.price >= minPrice);
    if (maxPrice !== undefined) products = products.filter((p) => p.price <= maxPrice);
    products.sort((a, b) => {
      const left = sort === "available_stock" ? a.stock - a.reserved_stock : a[sort];
      const right = sort === "available_stock" ? b.stock - b.reserved_stock : b[sort];
      return (left > right ? 1 : left < right ? -1 : 0) * (order === "asc" ? 1 : -1);
    });
    const total = products.length;
    res.json({
      data: publicProducts(products).slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      aggregations: aggregations(products),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await productStore.find(req.validated.params.id);
    return product && !product.deleted_at
      ? res.json({ data: serialize(product) })
      : res.status(404).json({ error: "Product not found" });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    const input = req.validated.body;
    if (
      (await productStore.all()).some(
        (p) => p.sku.toLowerCase() === input.sku.toLowerCase() && !p.deleted_at,
      )
    )
      return res.status(409).json({ error: "SKU already exists" });
    const now = new Date().toISOString();
    const product = await productStore.save({
      ...input,
      id: randomUUID(),
      category: typeof input.category === "string" ? { name: input.category } : input.category,
      reserved_stock: 0,
      seller: { id: req.auth.sub },
      rating: 0,
      review_count: 0,
      created_at: now,
      updated_at: now,
    });
    res.status(201).json({ data: serialize(product) });
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await productStore.find(req.validated.params.id);
    if (!product || product.deleted_at) return res.status(404).json({ error: "Product not found" });
    if (product.seller.id !== req.auth.sub && !req.auth.roles.includes("ADMIN"))
      return res.status(403).json({ error: "Not product owner" });
    const input = req.validated.body;
    if (
      input.sku &&
      (await productStore.all()).some(
        (p) =>
          p.id !== product.id && p.sku.toLowerCase() === input.sku.toLowerCase() && !p.deleted_at,
      )
    )
      return res.status(409).json({ error: "SKU already exists" });
    if (input.stock !== undefined && input.stock < product.reserved_stock)
      return res.status(409).json({ error: "Stock cannot be below reserved stock" });
    Object.assign(product, input, {
      category:
        input.category === undefined
          ? product.category
          : typeof input.category === "string"
            ? { name: input.category }
            : input.category,
      updated_at: new Date().toISOString(),
    });
    await productStore.update(product);
    res.json({ data: serialize(product) });
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await productStore.find(req.validated.params.id);
    if (!product || product.deleted_at) return res.status(404).json({ error: "Product not found" });
    if (product.seller.id !== req.auth.sub && !req.auth.roles.includes("ADMIN"))
      return res.status(403).json({ error: "Not product owner" });
    if (product.reserved_stock > 0)
      return res.status(409).json({ error: "Cannot delete product with active reservations" });
    await productStore.remove(product.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
