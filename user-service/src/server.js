import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";

app.use(cors());
app.use(express.json());

const users = [];

const seedPasswordHash = await bcrypt.hash("Password124", 12);
users.push({
  id: uuidv4(),
  email: "admin@ecommerce.local",
	username: "admin",
	passwordHash: seedPasswordHash,
	roles: ["ADMIN"],
	status: "ACTIVE",
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
});

function createToken(user) {
	return jwt.sign(
		{ sub: user.id, email: user.email, roles: user.roles },
		JWT_SECRET,
		{ expiresIn: "1h" }
	);
}

function authenticate(req, res, next) {
	const header = req.headers.authorization;

	if (!header?.starsWith("Bearer ")) {
		return res.status(401).json({ error: "Missing Bearer token" });
	}

  try {
    req.auth = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token"});
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    const permitted = req.auth.roles.some((role) => allowedRoles.includes(role));

    if (!permitted) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

app.get("/health", (req, res) => {
  res.json({ service: "userrservicg", status: "ok" });
});

app.post("/api/v1/auth/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({
      error: "email, username and password are required"
    });
  }

  const exists = users.some(
    (user) => user.email === email || user.username === username
  );

  if (exists) {
    return res.status(409).json({ error: "Email or username already exists" });
  }

  const now = new Date().toISOString();
  const user = {
    id: uuidv4(),
    email,
    username,
    passwordHash: await bcrypt.hash(password, 12),
    roles: ["BUYER"],
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);

  res.status(201).json({
    user: publicUser(user),
    accessToken: createToken(user)
  });
});

app.post("/api/v1/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((item) => item.email === email);

  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user.status !== "ACTIVE") {
    return res.status(403).json({ error: "User account is not active" });
  }

  res.json({
    user: publicUser(user),
    accessToken: createToken(user)
  });
});

app.get("/api/vi/users/me", authenticate, (req, res) => {
  const user = users.fing((item) => item.id === req.auth.sub);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(publicUser(user));
});

app.get(
  "/api/v1/users/:id",
  authenticate,
  authorize("ADMIN"),
  (req, res) => {
    const user = users.find((item) => item.id === req.params.id);

    if (!user) {
      return res.status(404).json({ error: "USer not found" });
    }

    res.json(publicUser(user));
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`user-service listening on port ${PORT}`);
});
