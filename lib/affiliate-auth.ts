/**
 * Affiliate-Auth — Magic-Link + Cookie-Session fuer das
 * /affiliate/*-Dashboard. Analog zu lib/admin/auth.ts aber pro-User
 * statt single-secret-admin.
 *
 * Auth-Flow:
 *   1. Affiliate gibt Email auf /affiliate/login ein
 *   2. Server-Action gen Token, insert in affiliate_magic_links,
 *      verschickt Magic-Link per Resend
 *   3. Click auf Link → /affiliate/auth/callback?token=…
 *   4. consumeMagicLink prueft Token, markiert used_at, returnt
 *      affiliate_id
 *   5. signAffiliateSession setzt HMAC-signed Cookie mit
 *      affiliate_id + expiry
 *   6. Spaetere Requests prueffen Cookie via verifyAffiliateSession
 *
 * Web-Crypto (statt node:crypto) damit alles in Edge + Node lauft.
 */

import "server-only";

import { getServerSupabase } from "./supabase-server";

const COOKIE_NAME = "cd_affiliate_session";
const SESSION_TTL_DAYS = 30;

const FIRST_LOGIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REGULAR_TOKEN_TTL_MS = 15 * 60 * 1000;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_TOKENS = 5;

export const AFFILIATE_SESSION_COOKIE = COOKIE_NAME;

function getSecret(): string {
  const secret = process.env.AFFILIATE_SESSION_SECRET;
  if (!secret) {
    throw new Error("AFFILIATE_SESSION_SECRET env var is not set");
  }
  return secret;
}

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

/**
 * Generiert ein zufaelliges 32-byte hex-Token. Wird als Magic-Link-
 * Payload genutzt — Token IST das Secret, kein separates Hashing noetig.
 */
export function generateRandomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type MagicLinkPurpose = "first_login" | "regular";

/**
 * Erzeugt einen Magic-Link-Token fuer den gegebenen Affiliate und
 * speichert ihn in affiliate_magic_links. Returnt den Token (vom Caller
 * an die Magic-Link-Mail anzuhaengen).
 *
 * Rate-Limit: max 5 unbenutzte Tokens pro Affiliate pro 1h-Fenster.
 * Verhindert Resend-Spam. Verbrauchte Tokens zaehlen nicht mit.
 */
export async function generateMagicLink(input: {
  affiliateId: string;
  purpose: MagicLinkPurpose;
}): Promise<
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; error: "rate_limited" | "db_error" }
> {
  const sb = getServerSupabase();

  // Rate-Limit-Check: count(*) unbenutzter Tokens in der letzten Stunde.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error: countErr } = await sb
    .from("affiliate_magic_links")
    .select("token", { count: "exact", head: true })
    .eq("affiliate_id", input.affiliateId)
    .gte("created_at", windowStart)
    .is("used_at", null);

  if (countErr) {
    console.error("[affiliate-auth] rate-limit count failed", countErr);
    return { ok: false, error: "db_error" };
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX_TOKENS) {
    return { ok: false, error: "rate_limited" };
  }

  const token = generateRandomToken();
  const ttlMs =
    input.purpose === "first_login"
      ? FIRST_LOGIN_TOKEN_TTL_MS
      : REGULAR_TOKEN_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  const { error: insertErr } = await sb.from("affiliate_magic_links").insert({
    token,
    affiliate_id: input.affiliateId,
    expires_at: expiresAt.toISOString(),
  });

  if (insertErr) {
    console.error("[affiliate-auth] insert magic link failed", insertErr);
    return { ok: false, error: "db_error" };
  }

  return { ok: true, token, expiresAt };
}

/**
 * Verifyt einen Magic-Link-Token und markiert ihn used_at = now() in
 * einer einzigen Transaktion. Returnt affiliate_id bei Erfolg.
 *
 * Failure-Modes:
 *   - unknown_token: Token existiert nicht
 *   - expired: Token war abgelaufen
 *   - already_used: used_at war schon gesetzt
 *   - removed: zugehoeriger Affiliate ist status='removed'
 */
export async function consumeMagicLink(token: string): Promise<
  | { ok: true; affiliateId: string }
  | { ok: false; error: "unknown_token" | "expired" | "already_used" | "removed" | "db_error" }
> {
  if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
    return { ok: false, error: "unknown_token" };
  }

  const sb = getServerSupabase();

  const { data: row, error } = await sb
    .from("affiliate_magic_links")
    .select(
      "token, affiliate_id, expires_at, used_at, affiliates!inner(status)",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[affiliate-auth] consume lookup failed", error);
    return { ok: false, error: "db_error" };
  }
  if (!row) return { ok: false, error: "unknown_token" };

  const r = row as unknown as {
    token: string;
    affiliate_id: string;
    expires_at: string;
    used_at: string | null;
    affiliates: { status: string };
  };

  if (r.used_at) return { ok: false, error: "already_used" };
  if (new Date(r.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }
  if (r.affiliates.status === "removed") {
    return { ok: false, error: "removed" };
  }

  // Atomisch markieren — wir setzen used_at nur wenn es noch null ist,
  // damit zwei gleichzeitige Clicks nur einer durchgeht.
  const { data: updated, error: updateErr } = await sb
    .from("affiliate_magic_links")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .select("token")
    .maybeSingle();

  if (updateErr) {
    console.error("[affiliate-auth] consume update failed", updateErr);
    return { ok: false, error: "db_error" };
  }
  if (!updated) {
    // Race-condition: jemand hat den Token zwischen Read und Update
    // verbraucht.
    return { ok: false, error: "already_used" };
  }

  // last_login_at + (wenn noch null) first_login_at setzen.
  // 2-Step weil Postgrest kein COALESCE im update kennt — wir hole erst
  // first_login_at, setze beide in einem Update damit es nur einen
  // Round-Trip gibt.
  const now = new Date().toISOString();
  const { data: aff } = await sb
    .from("affiliates")
    .select("first_login_at")
    .eq("id", r.affiliate_id)
    .maybeSingle();

  const updatePayload: { last_login_at: string; first_login_at?: string } = {
    last_login_at: now,
  };
  if (aff && !(aff as { first_login_at: string | null }).first_login_at) {
    updatePayload.first_login_at = now;
  }

  await sb
    .from("affiliates")
    .update(updatePayload)
    .eq("id", r.affiliate_id);

  return { ok: true, affiliateId: r.affiliate_id };
}

/**
 * Erzeugt einen Session-Cookie-Wert "<affiliate_id>.<expiryUnix>.<hmac>".
 * Cookie ist httpOnly + (in prod) Secure + SameSite=Strict.
 */
export async function signAffiliateSession(
  affiliateId: string,
): Promise<{ value: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400 * 1000);
  const payload = `${affiliateId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  const key = await hmacKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, encoder().encode(payload));
  return { value: `${payload}.${toHex(sig)}`, expiresAt };
}

/**
 * Verifyt einen Session-Cookie und returnt affiliate_id falls valid.
 * Checkt Signatur + Expiry + Affiliate-Status (removed → null).
 */
export async function verifyAffiliateSession(
  value: string | undefined,
): Promise<string | null> {
  if (!value) return null;

  // Format: "<uuid>.<expiry>.<sigHex>"
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [affiliateId, expiryStr, sigHex] = parts;

  const expiry = parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry)) return null;
  if (expiry * 1000 < Date.now()) return null;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  let sigBytes: Uint8Array;
  try {
    sigBytes = fromHex(sigHex);
  } catch {
    return null;
  }

  const payload = `${affiliateId}.${expiryStr}`;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    // @ts-expect-error - BufferSource accepts Uint8Array at runtime
    sigBytes,
    encoder().encode(payload),
  );
  if (!ok) return null;

  // Status-Check: removed → kein Login mehr, auch mit gueltigem Cookie.
  const sb = getServerSupabase();
  const { data: aff } = await sb
    .from("affiliates")
    .select("status")
    .eq("id", affiliateId)
    .maybeSingle();
  if (!aff) return null;
  if ((aff as { status: string }).status === "removed") return null;

  return affiliateId;
}

export function affiliateCookieOptions(expiresAt: Date) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function buildMagicLinkUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://callday.io";
  return `${base}/affiliate/auth/callback?token=${token}`;
}
