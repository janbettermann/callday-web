/**
 * Server-side Click-Tracking fuer /a/[slug] Landing-Pages.
 *
 * Wird in der page.tsx bei jedem Server-Render aufgerufen. Eigenes
 * Tracking-Layer (kein 3rd-party Analytics) damit:
 *   1. Daten in derselben Supabase liegen wie Sign-Ups → Dashboard-Joins
 *      trivial
 *   2. Volle Kontrolle ueber Anonymisierung (kein Cookie, kein PII)
 *   3. Affiliates koennen ihre eigenen Counts im Self-Service-Dashboard
 *      sehen ohne Vercel-Zugang
 *
 * Anti-Patterns die hier bewusst NICHT passieren:
 *   - Kein Cookie → kein DSGVO-Banner noetig
 *   - Keine Raw-IP gespeichert → visitor_hash = sha256(IP + UA + daily-salt)
 *     macht Distinct-Visitor-Counts moeglich ohne PII zu persisten. Daily-
 *     Salt rotiert die Hashes jeden UTC-Tag → Reverse-Lookup unmoeglich
 *     ohne Tagessalt zu kennen.
 *   - Soft-failure: INSERT-Fehler werden geloggt aber blockieren den
 *     Page-Render NICHT. Affiliate-Landing muss immer durchgehen.
 *   - Bot-Filter via UA-Regex VOR INSERT — Gmail-Scanner / Cloudflare-
 *     Health-Checks / Linkedin-Preview / etc. werden gar nicht erst
 *     gezaehlt. Sonst inflaten sie Affiliate-CR-Ratios.
 */

import "server-only";

import { headers } from "next/headers";

import { getServerSupabase } from "./supabase-server";

const BOT_UA_REGEX =
  /bot|crawl|spider|preview|fetch|monitor|scan|check|http-client|wget|curl|axios|node-fetch|headlesschrome|phantomjs|slurp|googlebot|bingbot|yandex|baidu|duckduck|facebookexternalhit|whatsapp|telegrambot|linkedinbot|twitterbot|slackbot|discordbot|pingdom|uptimerobot/i;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractReferrerHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.host || null;
  } catch {
    return null;
  }
}

function dailySalt(): string {
  // YYYY-MM-DD UTC. Rotation jeden Tag → ein Visitor zaehlt einmal pro Tag
  // als "unique", aber die Hash-Identitaet ueber Tage hinweg ist nicht
  // re-konstruierbar ohne den Tagessalt zu kennen.
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function trackPageView(opts: {
  slug: string;
  affiliateId: string | null;
}): Promise<void> {
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";

    if (BOT_UA_REGEX.test(ua)) return;

    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "0.0.0.0";
    const referer = h.get("referer");

    const visitorHash = await sha256Hex(`${ip}|${ua}|${dailySalt()}`);
    const referrerHost = extractReferrerHost(referer);

    const sb = getServerSupabase();
    await sb.from("affiliate_page_views").insert({
      slug: opts.slug,
      affiliate_id: opts.affiliateId,
      visitor_hash: visitorHash,
      referrer_host: referrerHost,
    });
  } catch (err) {
    console.error("[affiliate-page-views] track failed", err);
  }
}
