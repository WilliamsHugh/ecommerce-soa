import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { productStore } from "../stores/product.store.js";
import { createImageUploadUrl } from "../services/image.storage.js";

export async function presignImage(req, res, next) {
  try {
    const product = await productStore.find(req.validated.params.id);
    if (!product || product.deleted_at) return res.status(404).json({ error: "Product not found" });
    if (product.seller.id !== req.auth.sub && !req.auth.roles.includes("ADMIN"))
      return res.status(403).json({ error: "Not product owner" });
    if (!env.s3Endpoint && !env.s3PublicUrl)
      return res.status(503).json({ error: "Image storage is not configured" });
    const { filename, content_type: contentType, size } = req.validated.body;
    if (size > env.maxImageBytes)
      return res.status(413).json({ error: "Image exceeds maximum size" });
    const key = `products/${product.id}/${randomUUID()}-${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const publicUrl = `${(env.s3PublicUrl || env.s3Endpoint).replace(/\/$/, "")}/${env.s3Bucket}/${key}`;
    const uploadUrl = await createImageUploadUrl({ key, contentType, expiresIn: 900 });
    if (!uploadUrl)
      return res.status(503).json({ error: "Image storage credentials are not configured" });
    res.status(201).json({
      data: {
        key,
        content_type: contentType,
        max_size: env.maxImageBytes,
        upload_url: uploadUrl,
        public_url: publicUrl,
        expires_in: 900,
      },
    });
  } catch (error) {
    next(error);
  }
}
