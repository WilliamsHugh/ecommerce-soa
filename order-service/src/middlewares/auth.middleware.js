import jwt from "jsonwebtoken";

export function authenticate(req, res, next) {
  try {
    req.token = req.headers.authorization;
    req.auth = jwt.verify(
      req.token?.replace(/^Bearer\s+/i, ""),
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "development-secret-change-me",
    );
    next();
  } catch {
    res.status(401).json({ error: "Invalid or missing token" });
  }
}
