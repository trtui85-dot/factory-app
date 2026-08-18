import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { ah } from "./async.js";

const JWT_SECRET = process.env.JWT_SECRET || "factory-secret-change-me";
const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 30;

export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, phone: user.phone, role: user.role }, JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });

export const parsePerms = (raw) => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const publicUser = (u) => ({
  id: u.id,
  phone: u.phone,
  name: u.name,
  role: u.role,
  workerId: u.worker_id,
  permissions: parsePerms(u.permissions),
});

export const refreshTokenExpiry = () =>
  new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString();

const REFRESH_COOKIE = "factory_refresh";
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  path: "/api",
  maxAge: REFRESH_TTL_DAYS * 24 * 3600,
};

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
    try {
      const user = await db.get("SELECT * FROM users WHERE id = ? AND is_active = 1", payload.sub);
      if (!user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
    }
    next();
  };
}

export function requireModule(module, prefix) {
  return (req, res, next) => {
    if (req.user.role !== "WORKER") return next();
    if (prefix && !req.path.startsWith(prefix)) return next();
    if (!parsePerms(req.user.permissions).includes(module)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access to this module is not allowed" } });
    }
    if (req.method !== "GET") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Read-only access" } });
    }
    next();
  };
}

export function requireAdmin(prefix) {
  return (req, res, next) => {
    if (prefix && !req.path.startsWith(prefix)) return next();
    if (req.user.role === "WORKER") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Administrators only" } });
    }
    next();
  };
}

const router = Router();

router.post(
  "/login",
  ah(async (req, res) => {
    const { phone, pin } = req.body || {};
    if (typeof phone !== "string" || typeof pin !== "string") {
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "phone and pin are required" } });
    }
    const user = await db.get("SELECT * FROM users WHERE phone = ?", phone);
    if (!user || !bcrypt.compareSync(pin, user.pin)) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid phone or PIN" } });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: { code: "DISABLED", message: "Account disabled" } });
    }
    const token = signAccessToken(user);
    const refresh = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
    await db.run(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      user.id,
      refresh,
      refreshTokenExpiry()
    );
    res.cookie(REFRESH_COOKIE, refresh, cookieOpts);
    res.json({ token, user: publicUser(user) });
  })
);

router.post(
  "/refresh",
  ah(async (req, res) => {
    const refresh = req.cookies?.[REFRESH_COOKIE];
    if (!refresh) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Refresh token required" } });
    let payload;
    try {
      payload = jwt.verify(refresh, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } });
    }
    const row = await db.get("SELECT * FROM refresh_tokens WHERE token = ?", refresh);
    if (!row) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } });
    const user = await db.get("SELECT * FROM users WHERE id = ? AND is_active = 1", payload.sub);
    if (!user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User not found" } });
    const token = signAccessToken(user);
    res.json({ token, user: publicUser(user) });
  })
);

router.post(
  "/logout",
  authRequired,
  ah(async (req, res) => {
    const refresh = req.cookies?.[REFRESH_COOKIE];
    if (refresh) await db.run("DELETE FROM refresh_tokens WHERE token = ?", refresh);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
    res.json({ ok: true });
  })
);

export const authRouter = router;
