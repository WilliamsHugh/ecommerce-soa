export function notFound(_req, res) {
  res.status(404).json({ error: "Route not found" });
}
export function errorHandler(error, _req, res, _next) {
  if (error?.name === "ZodError")
    return res
      .status(400)
      .json({ error: "Validation failed", details: error.issues });
  const status = error.status || 500;
  res
    .status(status)
    .json({ error: status === 500 ? "Internal server error" : error.message });
}
