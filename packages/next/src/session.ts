import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Stateless session support: data is sealed into an AES-256-GCM encrypted,
 * authenticated cookie. No server-side store — the package stays deployable
 * anywhere. The key is derived from IMDX_SESSION_SECRET.
 */

export interface SessionData {
  login: string;
  /** GitHub access token (never exposed to the client in plaintext). */
  token: string;
  /** Unix ms expiry of the session itself. */
  expiresAt: number;
  /** Unix ms of the last successful repo-permission verification. */
  verifiedAt: number;
}

const VERSION = "v1";

function keyFor(secret: string): Buffer {
  if (secret.length < 16) {
    throw new Error("IMDX session secret must be at least 16 characters");
  }
  return createHash("sha256").update(secret).digest();
}

export function seal(data: SessionData, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function unseal(
  sealed: string,
  secret: string,
  now: () => number = Date.now,
): SessionData | null {
  try {
    const [version, ivB64, ctB64, tagB64] = sealed.split(".");
    if (version !== VERSION || !ivB64 || !ctB64 || !tagB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFor(secret),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]);
    const data = JSON.parse(plaintext.toString("utf8")) as SessionData;
    if (typeof data.expiresAt !== "number" || data.expiresAt < now()) return null;
    return data;
  } catch {
    return null; // tampered, malformed, or wrong key
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers (web-standard headers; no framework dependency)
// ---------------------------------------------------------------------------

export interface CookieOptions {
  maxAge?: number; // seconds
  path?: string;
  secure?: boolean;
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${options.path ?? "/"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  parts.push("HttpOnly");
  parts.push("SameSite=Lax");
  if (options.secure !== false) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name: string, path = "/"): string {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return out;
}
