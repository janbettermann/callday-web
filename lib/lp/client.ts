/**
 * Client-Seite des Landing-Page-Trackings.
 *
 * Modul-scoped Store (Muster wie use-signup-modal.ts): <LpSession> setzt
 * beim Mount den Kontext (Seite, Experiment, Variante vom Server; UTM,
 * fbclid und Referrer aus dem Browser) und schickt das view-Event. Die
 * CTAs und das SignupForm haengen ueber trackLpEvent daran, ohne Props
 * oder Context durch den Baum zu reichen.
 *
 * Die Session-ID lebt nur im Speicher dieses Seitenaufrufs — kein Cookie,
 * kein localStorage (bewusst: die Seite hat keinen Consent-Banner). Beim
 * Reload gibt es eine neue ID; der server-seitige Visitor-Hash haelt die
 * Events trotzdem zusammen.
 *
 * `overridden` (Vorschau per ?v=) schaltet alles stumm — die eigenen
 * QA-Klicks sollen nicht in der Auswertung landen.
 */

import {
  extractHost,
  pickUtm,
  type LpEvent,
  type LpPage,
  type LpUtm,
} from "./shared";

export interface LpClientContext {
  page: LpPage;
  experiment: string | null;
  variant: string | null;
  overridden: boolean;
  session: string;
  utm: LpUtm;
  referrerHost: string | null;
  fbclid: string | null;
}

export interface LpServerAssignment {
  page: LpPage;
  experiment: string | null;
  variant: string | null;
  overridden: boolean;
}

let ctx: LpClientContext | null = null;
let viewSent = false;

function makeSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export function initLpContext(server: LpServerAssignment): LpClientContext {
  // Idempotent pro Seitenaufruf: React-StrictMode feuert Effects doppelt,
  // ein zweiter Init darf weder Session-ID noch View-Flag zuruecksetzen.
  if (ctx && ctx.page === server.page) return ctx;

  const params = new URLSearchParams(window.location.search);
  const fbclidRaw = params.get("fbclid");
  ctx = {
    page: server.page,
    experiment: server.experiment,
    variant: server.variant,
    overridden: server.overridden,
    session: makeSessionId(),
    utm: pickUtm(Object.fromEntries(params)),
    referrerHost: extractHost(document.referrer),
    fbclid: fbclidRaw && fbclidRaw.length <= 200 ? fbclidRaw : null,
  };
  viewSent = false;
  return ctx;
}

export function getLpContext(): LpClientContext | null {
  return ctx;
}

function payload(extra: Record<string, unknown>) {
  if (!ctx) return null;
  return {
    page: ctx.page,
    experiment: ctx.experiment,
    variant: ctx.variant,
    session: ctx.session,
    utm: ctx.utm,
    referrerHost: ctx.referrerHost,
    fbclid: ctx.fbclid,
    ...extra,
  };
}

/**
 * Fire-and-forget an /api/lp-event. `keepalive` haelt den Request auch
 * dann am Leben, wenn die Seite direkt danach navigiert (OAuth-Redirect,
 * router.push nach dem Sign-up).
 */
export function trackLpEvent(event: LpEvent, label?: string): void {
  if (!ctx || ctx.overridden) return;
  if (event === "view") {
    if (viewSent) return;
    viewSent = true;
  }
  const body = payload({ event, label: label ?? null });
  if (!body) return;
  try {
    void fetch("/api/lp-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Netzwerkfehler sind hier egal — Tracking darf nie den Flow stoeren.
  }
}

/**
 * Landing-Kontext fuer supabase.auth.signUp({ options: { data } }) —
 * landet als user_metadata.lp und wird in /api/app-download-mail nach
 * der OTP-Bestaetigung gelesen. Ohne Kontext (Sign-up von /lists, /login)
 * bleibt das Objekt leer. fbclid bleibt bewusst draussen: user_metadata
 * ist dauerhaft, der Click-Id gehoert nicht in den Account.
 */
export function lpSignupMetadata(): { lp?: Record<string, unknown> } {
  if (!ctx || ctx.overridden) return {};
  return {
    lp: {
      page: ctx.page,
      experiment: ctx.experiment,
      variant: ctx.variant,
      session: ctx.session,
      utm: ctx.utm,
      referrerHost: ctx.referrerHost,
    },
  };
}

/**
 * Kurzlebiger Cookie fuer den OAuth-Umweg (Apple/Google): Supabase
 * strippt Query-Params von redirectTo, deshalb dasselbe Muster wie
 * affiliate_slug / signup_flow in SignupForm. /auth/callback liest und
 * loescht ihn. 5 Minuten = OAuth-Roundtrip.
 */
export function writeLpSignupCookie(): void {
  if (!ctx || ctx.overridden || typeof document === "undefined") return;
  const value = encodeURIComponent(
    JSON.stringify({
      page: ctx.page,
      experiment: ctx.experiment,
      variant: ctx.variant,
      session: ctx.session,
      utm: ctx.utm,
      referrerHost: ctx.referrerHost,
      fbclid: ctx.fbclid,
    }),
  );
  document.cookie = `lp_ctx=${value}; path=/; max-age=300; samesite=lax`;
}
