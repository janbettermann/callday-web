/**
 * Outscraper-API-Client (Google-Maps-Search) — strikt server-seitig,
 * der API-Key darf nie in Client-Bundles landen.
 *
 * Async-Flow: startGoogleMapsSearch schickt den Job mit async=true +
 * webhook ab und liefert die Request-ID. Ergebnisse holen wir immer
 * authenticated ueber getRequestResults (Outscraper haelt sie ~4h vor)
 * — auch im Webhook-Handler: der Webhook ist nur der "fertig"-Ping,
 * seinem Payload vertrauen wir nicht.
 */

const OUTSCRAPER_BASE_URL = "https://api.outscraper.cloud";

/**
 * Feldnamen live verifiziert (2026-07-12, echter API-Response): Website
 * heisst `website`, die volle Adresse `address`. Die OpenAPI-Doku nennt
 * teils `site`/`full_address` — beide bleiben als Fallback im Type und
 * Mapping, falls Outscraper das Shape je zurueckdreht.
 */
export interface OutscraperPlace {
  query?: string;
  name?: string;
  phone?: string;
  website?: string;
  site?: string;
  address?: string;
  full_address?: string;
  category?: string;
  business_status?: string;
}

export type OutscraperResultStatus = "pending" | "success" | "failed";

export interface OutscraperResults {
  status: OutscraperResultStatus;
  places: OutscraperPlace[];
}

/** Felder eingrenzen — kleinerer Payload, schnellere Antwort. */
const RESULT_FIELDS =
  "query,name,phone,website,site,address,full_address,category,business_status";

function getApiKey(): string {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error("OUTSCRAPER_API_KEY is not set");
  return key;
}

interface StartSearchOptions {
  query: string;
  limit: number;
  region: string;
  language: string;
  webhookUrl: string;
}

/** Startet den async Google-Maps-Search-Job, gibt die Request-ID zurueck. */
export async function startGoogleMapsSearch(
  options: StartSearchOptions,
): Promise<string> {
  const params = new URLSearchParams({
    query: options.query,
    limit: String(options.limit),
    async: "true",
    language: options.language,
    region: options.region,
    webhook: options.webhookUrl,
    fields: RESULT_FIELDS,
  });

  const response = await fetch(
    `${OUTSCRAPER_BASE_URL}/google-maps-search?${params.toString()}`,
    { headers: { "X-API-KEY": getApiKey() }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      `Outscraper start failed: ${response.status} ${await safeText(response)}`,
    );
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Outscraper start returned no request id");
  }
  return payload.id;
}

/**
 * Ergebnis-Lookup per Request-ID. Outscrapers data-Shape ist ein Array
 * pro Query (wir schicken genau eine) — beide Formen (nested/flach)
 * werden auf eine flache Place-Liste normalisiert.
 */
export async function getRequestResults(
  requestId: string,
): Promise<OutscraperResults> {
  const response = await fetch(
    `${OUTSCRAPER_BASE_URL}/requests/${encodeURIComponent(requestId)}`,
    { headers: { "X-API-KEY": getApiKey() }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Outscraper request lookup failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    data?: unknown;
  };
  const status = normalizeStatus(payload.status);
  if (status !== "success") return { status, places: [] };

  return { status, places: flattenPlaces(payload.data) };
}

function normalizeStatus(raw: string | undefined): OutscraperResultStatus {
  const value = (raw ?? "").toLowerCase();
  if (["success", "finished", "completed"].includes(value)) return "success";
  if (value.includes("error") || value.includes("fail")) return "failed";
  return "pending";
}

function flattenPlaces(data: unknown): OutscraperPlace[] {
  if (!Array.isArray(data)) return [];
  if (data.length > 0 && Array.isArray(data[0])) {
    return (data as OutscraperPlace[][]).flat();
  }
  return data as OutscraperPlace[];
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "";
  }
}
