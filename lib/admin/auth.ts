/**
 * Admin-Auth — Cookie-basierte Session mit HMAC-signiertem Wert.
 *
 * Layer 1: ADMIN_PATH (URL-Segment) — schuetzt vor Drive-by-Scannern.
 *          Falsche Pfade kriegen Standard-Next-404 ohne weiteren Hinweis.
 * Layer 2: ADMIN_PASSWORD (Login-Form) — schuetzt davor, dass der
 *          Pfad allein reicht (z.B. wenn er via Referer leakt).
 * Layer 3: HMAC-signiertes Cookie — verhindert Forgery sobald die
 *          Session steht. Cookie ist httpOnly + Secure + SameSite=Strict.
 *
 * Web-Crypto (statt node:crypto), damit die Helpers in Edge-Middleware
 * und in Node-Server-Components gleichermassen laufen.
 */

const COOKIE_NAME = "cd_session";
const SESSION_TTL_DAYS = 30;

function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("ADMIN_PASSWORD env var is not set");
  }
  return secret;
}

export function getAdminPath(): string | null {
  return process.env.ADMIN_PATH ?? null;
}

export const ADMIN_SESSION_COOKIE = COOKIE_NAME;

function encoder() {
  return new TextEncoder();
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Erzeugt einen signierten Cookie-Wert "<expiryUnix>.<hmacHex>". */
export async function signSession(): Promise<{
  value: string;
  expiresAt: Date;
}> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400 * 1000);
  const payload = String(Math.floor(expiresAt.getTime() / 1000));
  const key = await hmacKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, encoder().encode(payload));
  return { value: `${payload}.${toHex(sig)}`, expiresAt };
}

/**
 * Prueft einen Cookie-Wert. True wenn Signatur valide UND nicht abgelaufen.
 * Timing-safe-compare ueber crypto.subtle.verify.
 */
export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sigHex = value.slice(dot + 1);

  const expiry = parseInt(payload, 10);
  if (!Number.isFinite(expiry)) return false;
  if (expiry * 1000 < Date.now()) return false;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }

  let sigBytes: Uint8Array;
  try {
    sigBytes = fromHex(sigHex);
  } catch {
    return false;
  }

  const key = await hmacKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    // @ts-expect-error - BufferSource accepts Uint8Array at runtime
    sigBytes,
    encoder().encode(payload),
  );
}

/**
 * Cookie-Optionen die wir konsistent ueberall setzen. `secure` ist in
 * Production immer an; im Dev (HTTP localhost) muss es aus damit der
 * Browser das Cookie ueberhaupt akzeptiert.
 */
export function cookieOptions(expiresAt: Date) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };
}
