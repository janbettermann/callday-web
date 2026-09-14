/**
 * POST /api/lp-event — Client-Events des Landing-Page-Trackings
 * (view, cta_click, signup_started). `signup_confirmed` wird NICHT hier
 * angenommen, das schreiben ausschliesslich die Server-Pfade
 * (/api/app-download-mail, /auth/callback) nach echter Bestaetigung.
 *
 * Der Client schickt nur den Kontext (Seite, Experiment, Variante, UTM,
 * Referrer, Session). Alles Identifizierende leitet der Server aus dem
 * Request ab: Visitor-Hash aus IP + User-Agent (nie gespeichert), Geraet
 * und In-App-Browser aus dem User-Agent, Land aus dem Vercel-Header.
 *
 * Antwort ist immer 204, auch bei Bots oder unbekanntem Experiment — der
 * Client wartet auf nichts (keepalive-Fetch).
 */

import { after, type NextRequest } from "next/server";

import { ACTIVE_EXPERIMENT, findVariant } from "@/lib/lp/experiments";
import { sendMetaConversion } from "@/lib/lp/meta-capi";
import {
  insertLpEvent,
  requestInfoFrom,
  visitorHashFor,
} from "@/lib/lp/server";
import {
  LP_EVENTS,
  LP_PAGES,
  clipString,
  deriveSource,
  parseLpUserAgent,
  pickUtm,
  type LpEvent,
  type LpPage,
} from "@/lib/lp/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CONTENT = () => new Response(null, { status: 204 });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return new Response(null, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const event = (LP_EVENTS as readonly string[]).includes(String(o.event))
    ? (o.event as LpEvent)
    : null;
  if (!event || event === "signup_confirmed") {
    return new Response(null, { status: 400 });
  }
  const page: LpPage = (LP_PAGES as readonly string[]).includes(String(o.page))
    ? (o.page as LpPage)
    : "landing";

  const info = requestInfoFrom((name) => request.headers.get(name));
  const ua = parseLpUserAgent(info.ua);
  if (ua.isBot) return NO_CONTENT();

  // Nur das aktive Experiment mit bekannter Variante zaehlt als Test-
  // Event. Alles andere (Tab von vor einem Deploy, manipulierter Body)
  // wird als normaler Funnel-Besuch ohne Experiment gespeichert.
  const experimentRaw = clipString(o.experiment, 60);
  const variantRaw = clipString(o.variant, 40);
  const active = ACTIVE_EXPERIMENT;
  const validTest =
    active && experimentRaw === active.key && findVariant(active, variantRaw);
  const experiment = validTest ? active.key : null;
  const variant = validTest ? variantRaw : null;

  const utmRaw =
    o.utm && typeof o.utm === "object" ? (o.utm as Record<string, unknown>) : null;
  const utm = pickUtm(utmRaw);
  const referrerHost = clipString(o.referrerHost, 120);
  const fbclid = clipString(o.fbclid, 200);
  const source = deriveSource(utm.utm_source, referrerHost, !!fbclid);
  const label = clipString(o.label, 40);
  const session = clipString(o.session, 64);

  const visitor = await visitorHashFor(info);
  const sourceUrl =
    request.headers.get("referer") ?? `${new URL(request.url).origin}/`;

  after(async () => {
    await insertLpEvent({
      page,
      event,
      label,
      experiment_key: experiment,
      variant,
      visitor_hash: visitor,
      session_id: session,
      user_id: null,
      source,
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_content: utm.utm_content ?? null,
      utm_term: utm.utm_term ?? null,
      referrer_host: referrerHost,
      device: ua.device,
      platform: ua.platform,
      in_app: ua.inApp,
      country: info.country,
    });

    if (event === "signup_started") {
      await sendMetaConversion({
        eventName: "Lead",
        eventId: `lead-${session ?? visitor}`,
        sourceUrl,
        ip: info.ip,
        ua: info.ua,
        country: info.country,
        fbclid,
        customData: { experiment, variant, source, method: label },
      });
    }
  });

  return NO_CONTENT();
}
