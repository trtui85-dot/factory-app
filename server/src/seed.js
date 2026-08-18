import bcrypt from "bcryptjs";
import { initDb, db } from "./db.js";

await initDb();

const adminPin = bcrypt.hashSync("2222", 10);

const admin = await db.get("SELECT * FROM users WHERE phone = ?", "22222222");
if (!admin) {
  await db.run(
    "INSERT INTO users (phone, pin, name, role) VALUES (?, ?, ?, 'OWNER')",
    "22222222",
    adminPin,
    "مدير المصنع"
  );
  console.log("Admin created: phone=22222222 pin=2222");
} else {
  console.log("Admin already exists");
}

process.exit(0);
