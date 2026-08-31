import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { closeDatabase } from "../src/config/database.js";
import { userStore } from "../src/stores/user.store.js";

const { ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  throw new Error("ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD (min 12 chars) are required");
}
const existing = await userStore.findByEmail(ADMIN_EMAIL.toLowerCase());
if (!existing) {
  await userStore.create({
    id: randomUUID(),
    email: ADMIN_EMAIL.toLowerCase(),
    username: ADMIN_USERNAME,
    password_hash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    roles: ["ADMIN"],
    status: "ACTIVE",
  });
  console.log(`Admin ${ADMIN_EMAIL} created`);
} else {
  console.log(`Admin ${ADMIN_EMAIL} already exists`);
}
await closeDatabase();
