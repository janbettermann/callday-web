/**
 * Server-Seite des Landing-Page-Trackings: Varianten-Zuweisung, Visitor-
 * Hash, Event-Insert und die Sign-up-Attribution.
 *
 * Datenschutz-Haltung wie lib/affiliate-page-views.ts: kein Cookie, keine
 * Roh-IP. Der Visitor-Hash ist sha256(IP | User-Agent | Salt). Anders als
 * beim Affiliate-Tracking rotiert der Salt NICHT taeglich: derselbe
 * Besucher soll ueber die ganze Testdauer dieselbe Variante sehen. Der
 * Salt ist ein Server-Geheimnis (LP_VISITOR_SALT), ohne ihn ist der Hash
 * nicht rueckrechenbar.
 *
 * Bekannte Grenze: hinter Carrier-NAT teilen sich viele Handys eine IP,
 * und iPhones im Instagram-Browser haben nahezu identische User-Agents.
 * Solche Besucher fallen im Hash zusammen (gleiche Variante, ein "Unique").
 * Fuer Ad-Traffic, der in derselben Session konvertiert, verzerrt das den
 * Vergleich nicht, es drueckt nur die absoluten Besucherzahlen.
 */

import "server-only";

import { headers } from "next/headers";

import { getServerSupabase } from "@/lib/supabase-server";

import { ACTIVE_EXPERIMENT } from "./experiments";
import { sendMetaConversion } from "./meta-capi";
import {
  clipString,
  deriveSource,
  hashToUnit,
  parseLpUserAgent,
  pickUtm,
  pickVariant,
  readOverride,
  type LpDevice,
  type LpEvent,
  type LpPage,
  type LpPlatform,
  type LpSource,
  type LpUtm,
} from "./shared";

// ----------------------------------------------------------------
// Request-Infos + Visitor-Hash
// ----------------------------------------------------------------

export interface LpRequestInfo {
  ip: string;
  ua: string;
  /** ISO-3166-Alpha-2 aus dem Vercel-Header, lokal null. */
  country: string | null;
}

export function requestInfoFrom(
  get: (name: string) => string | null,
): LpRequestInfo {
  const ip =
    get("x-forwarded-for")?.split(",")[0]?.trim() ||
    get("x-real-ip") ||
    "0.0.0.0";
  const ua = get("user-agent") ?? "";
  const country = clipString(get("x-vercel-ip-country"), 2)?.toUpperCase() ?? null;
  return { ip, ua, country };
}

export async function readRequestInfo(): Promise<LpRequestInfo> {
  const h = await headers();
  return requestInfoFrom((name) => h.get(name));
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function visitorSalt(): string {
  // Fallback nur fuer lokale Entwicklung — in Production den Salt setzen
  // (docs/experiments.md). Ein Salt-Wechsel mischt laufende Tests neu.
  return process.env.LP_VISITOR_SALT || "callday-lp-dev-salt";
}

export async function visitorHashFor(info: LpRequestInfo): Promise<string> {
  return sha256Hex(`${info.ip}|${info.ua}|${visitorSalt()}`);
}

// ----------------------------------------------------------------
// Varianten-Zuweisung
// ----------------------------------------------------------------

export interface LpAssignment {
  experiment: string | null;
  variant: string | null;
  /** true bei `?v=<key>` — Vorschau fuer QA, wird nicht getrackt. */
  overridden: boolean;
}

export const NO_ASSIGNMENT: LpAssignment = {
  experiment: null,
  variant: null,
  overridden: false,
};

/**
 * Zuweisung fuer die organische Landing. Ohne aktives Experiment kommt
 * NO_ASSIGNMENT zurueck (Default-Seite, Baseline-Tracking laeuft).
 *
 * Bucket = sha256(visitorHash | experimentKey): pro Experiment eine
 * eigene Zufallsreihenfolge, damit ein Besucher nicht in jedem Test
 * automatisch "b" bekommt.
 */
export async function assignLandingVariant(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<LpAssignment> {
  const experiment = ACTIVE_EXPERIMENT;
  if (!experiment) return NO_ASSIGNMENT;

  const override = readOverride(searchParams.v, experiment.variants);
  if (override) {
    return { experiment: experiment.key, variant: override, overridden: true };
  }

  const info = await readRequestInfo();
  const visitor = await visitorHashFor(info);
  const bucket = await sha256Hex(`${visitor}|${experiment.key}`);
  const variant = pickVariant(hashToUnit(bucket), experiment.variants);
  return { experiment: experiment.key, variant: variant.key, overridden: false };
}

// ----------------------------------------------------------------
// Event-Insert
// ----------------------------------------------------------------

export interface LpEventInsert {
  page: LpPage;
  event: LpEvent;
  label: string | null;
  experiment_key: string | null;
  variant: string | null;
  visitor_hash: string;
  session_id: string | null;
  user_id: string | null;
  source: LpSource;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer_host: string | null;
  device: LpDevice;
  platform: LpPlatform;
  in_app: boolean;
  country: string | null;
}

/**
 * Soft-failure wie beim Affiliate-Tracking: ein Insert-Fehler darf nie
 * einen Seitenaufruf oder Sign-up blockieren. 23505 (Unique-Verletzung)
 * ist der erwartete Fall fuer ein doppeltes signup_confirmed pro User.
 */
export async function insertLpEvent(row: LpEventInsert): Promise<void> {
  try {
    const sb = getServerSupabase();
    const { error } = await sb.from("lp_events").insert(row);
    if (!error || error.code === "23505") return;
    if (error.code === "PGRST205" || error.code === "42P01") {
      // Tabelle fehlt: Migration 0058_lp_events.sql (App-Repo) noch nicht
      // angewendet. Ein Satz statt des ganzen Error-Objekts pro Event.
      console.warn("[lp] lp_events fehlt — Migration 0058 anwenden (docs/experiments.md)");
      return;
    }
    console.error("[lp] insert failed", error);
  } catch (err) {
    console.error("[lp] insert threw", err);
  }
}

// ----------------------------------------------------------------
// Sign-up-Attribution
//
// Der Client haengt den Landing-Kontext an den Sign-up (Email/PW: als
// user_metadata.lp; OAuth: Cookie `lp_ctx`, 5 Minuten, wie affiliate_slug).
// Beide Pfade landen hier in recordSignupConfirmed. Der Profil-Trigger
// (handle_new_user) bleibt unangetastet — Attribution ist App-Sache.
// ----------------------------------------------------------------

export const LP_COOKIE_NAME = "lp_ctx";

export interface LpSignupContext {
  page: LpPage;
  experiment: string | null;
  variant: string | null;
  session: string | null;
  utm: LpUtm;
  referrerHost: string | null;
  fbclid: string | null;
}

export function parseLpSignupContext(raw: unknown): LpSignupContext | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const page: LpPage | null =
    o.page === "affiliate" ? "affiliate" : o.page === "landing" ? "landing" : null;
  if (!page) return null;
  const utmRaw =
    o.utm && typeof o.utm === "object" ? (o.utm as Record<string, unknown>) : null;
  return {
    page,
    experiment: clipString(o.experiment, 60),
    variant: clipString(o.variant, 40),
    session: clipString(o.session, 64),
    utm: pickUtm(utmRaw),
    referrerHost: clipString(o.referrerHost, 120),
    fbclid: clipString(o.fbclid, 200),
  };
}

export function parseLpCookie(raw: string | undefined): LpSignupContext | null {
  if (!raw) return null;
  try {
    return parseLpSignupContext(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return null;
  }
}

/**
 * Bestaetigter Sign-up: ein `signup_confirmed`-Event pro User (Unique-
 * Index in lp_events) plus CompleteRegistration an Meta (env-gated,
 * Nicht-EU). Ohne Landing-Kontext (z. B. Sign-up ueber /lists oder
 * /login) passiert nichts — der User war nie im Funnel dieser Seite.
 */
export async function recordSignupConfirmed(input: {
  userId: string;
  email: string | null;
  ctx: LpSignupContext | null;
  info: LpRequestInfo;
  sourceUrl: string;
}): Promise<void> {
  const { ctx, info } = input;
  if (!ctx) return;

  const ua = parseLpUserAgent(info.ua);
  const visitor = await visitorHashFor(info);
  const source = deriveSource(ctx.utm.utm_source, ctx.referrerHost, !!ctx.fbclid);

  await insertLpEvent({
    page: ctx.page,
    event: "signup_confirmed",
    label: null,
    experiment_key: ctx.experiment,
    variant: ctx.variant,
    visitor_hash: visitor,
    session_id: ctx.session,
    user_id: input.userId,
    source,
    utm_source: ctx.utm.utm_source ?? null,
    utm_medium: ctx.utm.utm_medium ?? null,
    utm_campaign: ctx.utm.utm_campaign ?? null,
    utm_content: ctx.utm.utm_content ?? null,
    utm_term: ctx.utm.utm_term ?? null,
    referrer_host: ctx.referrerHost,
    device: ua.device,
    platform: ua.platform,
    in_app: ua.inApp,
    country: info.country,
  });

  await sendMetaConversion({
    eventName: "CompleteRegistration",
    eventId: `reg-${input.userId}`,
    sourceUrl: input.sourceUrl,
    ip: info.ip,
    ua: info.ua,
    country: info.country,
    email: input.email,
    fbclid: ctx.fbclid,
    customData: {
      experiment: ctx.experiment,
      variant: ctx.variant,
      source,
    },
  });
}
