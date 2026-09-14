/**
 * Meta Conversions API (server-seitig), damit Meta die Auslieferung auf
 * echte Registrierungen optimieren kann. Kein Browser-Pixel: der wuerde
 * bei EU-Besuchern einen Consent-Banner erzwingen, den die Seite bewusst
 * nicht hat.
 *
 * Gates, in dieser Reihenfolge:
 *   1. META_PIXEL_ID + META_CAPI_TOKEN gesetzt — sonst "skipped".
 *   2. Land nicht in EU/EWR/UK/CH (Vercel-Header x-vercel-ip-country).
 *      Unbekanntes Land (lokal) → skipped, lieber ein Event zu wenig.
 *
 * Events: "Lead" bei signup_started, "CompleteRegistration" bei
 * signup_confirmed (mit gehashter Email als Match-Key). event_id ist pro
 * User/Session stabil, Meta dedupliziert Wiederholungen selbst.
 *
 * Fuer die Testauswertung ist das irrelevant — die Entscheidung faellt auf
 * den eigenen Zahlen in lp_events.
 */

import "server-only";

const EU_EEA_UK_CH = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]);

export type MetaEventName = "Lead" | "CompleteRegistration";

export interface MetaConversionInput {
  eventName: MetaEventName;
  /** Stabil pro Ereignis, Meta dedupliziert darauf. */
  eventId: string;
  sourceUrl: string;
  ip: string | null;
  ua: string | null;
  country: string | null;
  email?: string | null;
  /** fbclid aus der Landing-URL; wird zu fbc formatiert. */
  fbclid?: string | null;
  customData?: Record<string, string | number | null | undefined>;
}

export interface MetaConversionResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isRestrictedCountry(country: string | null): boolean {
  if (!country) return true;
  return EU_EEA_UK_CH.has(country.toUpperCase());
}

export async function sendMetaConversion(
  input: MetaConversionInput,
): Promise<MetaConversionResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { status: "skipped", reason: "not configured" };
  if (isRestrictedCountry(input.country)) {
    return { status: "skipped", reason: "restricted country" };
  }

  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const testCode = process.env.META_CAPI_TEST_CODE;

  const userData: Record<string, unknown> = {};
  if (input.ip) userData.client_ip_address = input.ip;
  if (input.ua) userData.client_user_agent = input.ua;
  if (input.email) {
    userData.em = [await sha256Hex(input.email.trim().toLowerCase())];
  }
  if (input.fbclid) {
    userData.fbc = `fb.1.${Date.now()}.${input.fbclid}`;
  }

  const customData: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(input.customData ?? {})) {
    if (v !== null && v !== undefined) customData[k] = v;
  }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
    access_token: token,
  };
  if (testCode) payload.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${pixelId}/events`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[meta-capi] send failed", res.status, text.slice(0, 300));
      return { status: "failed", reason: `http ${res.status}` };
    }
    return { status: "sent" };
  } catch (err) {
    console.error("[meta-capi] send threw", err);
    return { status: "failed", reason: err instanceof Error ? err.message : "unknown" };
  }
}
