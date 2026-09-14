/**
 * Pure Helfer fuer das Landing-Page-Tracking — ohne Next-/Supabase-Imports,
 * damit sie in Server-Code, Client-Code und Vitest gleich laufen.
 */

import type { LpVariant } from "./experiments";

export const LP_EVENTS = [
  "view",
  "cta_click",
  "signup_started",
  "signup_confirmed",
] as const;
export type LpEvent = (typeof LP_EVENTS)[number];

export const LP_PAGES = ["landing", "affiliate"] as const;
export type LpPage = (typeof LP_PAGES)[number];

export type LpSource = "meta" | "google" | "direct" | "other";
export type LpDevice = "mobile" | "desktop";
export type LpPlatform = "ios" | "android" | "other";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type LpUtm = Partial<Record<UtmKey, string | null>>;

/**
 * Bot-Filter wie in lib/affiliate-page-views.ts, plus die Performance-
 * und Screenshot-Crawler, die auf einer beworbenen Seite dazukommen.
 * Greift VOR jedem Insert — Link-Previews (Meta, WhatsApp, Slack) wuerden
 * sonst als Besucher zaehlen und die Raten nach unten druecken.
 */
export const LP_BOT_UA_REGEX =
  /bot|crawl|spider|preview|fetch|monitor|scan|check|http-client|wget|curl|axios|node-fetch|headlesschrome|phantomjs|slurp|googlebot|bingbot|yandex|baidu|duckduck|facebookexternalhit|whatsapp|telegrambot|linkedinbot|twitterbot|slackbot|discordbot|pingdom|uptimerobot|lighthouse|gtmetrix|pagespeed|vercel-screenshot|ptst/i;

export interface LpUserAgentInfo {
  device: LpDevice;
  platform: LpPlatform;
  /** Instagram-/Facebook-In-App-Browser — dort landet fast aller Meta-Traffic. */
  inApp: boolean;
  isBot: boolean;
}

export function parseLpUserAgent(ua: string | null | undefined): LpUserAgentInfo {
  const s = ua ?? "";
  const isBot = !s || LP_BOT_UA_REGEX.test(s);
  const platform: LpPlatform = /iPhone|iPad|iPod/i.test(s)
    ? "ios"
    : /Android/i.test(s)
      ? "android"
      : "other";
  const device: LpDevice =
    platform !== "other" || /Mobi|Mobile/i.test(s) ? "mobile" : "desktop";
  const inApp = /FBAN|FBAV|FB_IAB|Instagram/i.test(s);
  return { device, platform, inApp, isBot };
}

const META_HOSTS = /(^|\.)(facebook\.com|instagram\.com|fb\.com|fb\.me|messenger\.com)$/i;
const GOOGLE_HOSTS = /(^|\.)google(\.[a-z]{2,3})?(\.[a-z]{2})?$|googleadservices\.com$/i;

/**
 * Quelle eines Besuchs. UTM schlaegt Referrer: Meta-In-App-Browser
 * schicken oft gar keinen Referer, das fbclid in der URL ist dann das
 * einzige Signal.
 */
export function deriveSource(
  utmSource: string | null | undefined,
  referrerHost: string | null | undefined,
  hasFbclid: boolean,
): LpSource {
  const utm = (utmSource ?? "").trim().toLowerCase();
  if (utm) {
    if (["meta", "fb", "ig", "facebook", "instagram"].includes(utm)) return "meta";
    if (["google", "adwords", "gads"].includes(utm)) return "google";
    return "other";
  }
  if (hasFbclid) return "meta";
  const host = (referrerHost ?? "").trim().toLowerCase();
  if (!host) return "direct";
  if (META_HOSTS.test(host)) return "meta";
  if (GOOGLE_HOSTS.test(host)) return "google";
  return "other";
}

export function extractHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).host;
    return host ? host.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Erste 8 Hex-Zeichen eines Hashes als Zahl in [0, 1). */
export function hashToUnit(hex: string): number {
  const slice = hex.slice(0, 8);
  const n = parseInt(slice, 16);
  if (!Number.isFinite(n)) return 0;
  return n / 0x100000000;
}

/** Gewichtete Auswahl; `unit` in [0, 1). Deterministisch fuer gleichen Input. */
export function pickVariant(unit: number, variants: LpVariant[]): LpVariant {
  if (variants.length === 0) {
    throw new Error("pickVariant: experiment has no variants");
  }
  const total = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  if (total <= 0) return variants[0];
  let cursor = Math.min(Math.max(unit, 0), 0.999999999) * total;
  for (const v of variants) {
    cursor -= Math.max(0, v.weight);
    if (cursor < 0) return v;
  }
  return variants[variants.length - 1];
}

/** Trimmt einen Fremdwert auf String, kappt die Laenge, leer → null. */
export function clipString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/** Nur die UTM-Keys, jeweils gekappt. */
export function pickUtm(input: Record<string, unknown> | null | undefined): LpUtm {
  const out: LpUtm = {};
  if (!input) return out;
  for (const key of UTM_KEYS) {
    const v = clipString(input[key], 120);
    if (v) out[key] = v;
  }
  return out;
}

/** `?v=` ist ein Override, wenn der Wert eine bekannte Varianten-Key ist. */
export function readOverride(
  raw: string | string[] | undefined,
  variants: LpVariant[],
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return variants.some((v) => v.key === value) ? value : null;
}
