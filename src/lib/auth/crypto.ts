import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SECRET = process.env.SESSION_SECRET || "dev-only-foodoo365-demo-secret-change-me";

export interface TokenPayload {
  purpose: "session" | "reset" | "password" | "profile" | "reads";
  exp: number;
}

function sign(payload: string): string {
  const mac = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function unsign(token: string): string | null {
  const index = token.lastIndexOf(".");
  if (index <= 0) return null;
  const payload = token.slice(0, index);
  const mac = token.slice(index + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return payload;
}

export function seal<T extends TokenPayload>(payload: T): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return sign(body);
}

export function open<T extends TokenPayload>(token: string | undefined, purpose: TokenPayload["purpose"]): T | null {
  if (!token) return null;
  const body = unsign(token);
  if (!body) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (payload.purpose !== purpose || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");
  return `${salt}.${hash}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(".");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const current = Buffer.from(hash, "base64url");
  if (next.length !== current.length) return false;
  return timingSafeEqual(next, current);
}

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
