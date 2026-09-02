export const resourceOwners = Object.freeze({
  auth: "user",
  users: "user",
  products: "product",
  inventory: "product",
  orders: "order",
  payments: "payment",
  notifications: "notification",
});

const publicAuthRoutes = new Set([
  "POST /api/v1/auth/register",
  "POST /api/v1/auth/login",
  "POST /api/v1/auth/refresh",
  "POST /api/v1/auth/forgot-password",
  "POST /api/v1/auth/reset-password",
]);

export function isPublicRequest(req) {
  if (req.method === "GET" && req.params.resource === "products") return true;
  return publicAuthRoutes.has(`${req.method} ${req.originalUrl.split("?")[0]}`);
}
