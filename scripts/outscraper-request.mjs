// Diagnose: Was hat Outscraper fuer eine Request-ID wirklich geliefert?
//
//   node scripts/outscraper-request.mjs <outscraper_request_id>
//
// Beantwortet "Outscraper hat 0 geliefert" vs. "Pipeline hat alles
// gefiltert" ohne den Prod-Pfad anzufassen (Request-IDs stehen in
// lead_gen_jobs.outscraper_request_id, Ergebnisse ~4 h abrufbar).
// Liest OUTSCRAPER_API_KEY aus .env.local, gibt den Key nie aus.
// Entstanden 2026-09-11 beim Website-Filter-Bug (Spec §6b).
import { readFileSync } from "node:fs";

const requestId = process.argv[2];
if (!requestId) {
  console.error("usage: node scripts/outscraper-request.mjs <request-id>");
  process.exit(1);
}

const envPath = new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
if (!env.OUTSCRAPER_API_KEY) {
  console.error("OUTSCRAPER_API_KEY fehlt in .env.local");
  process.exit(1);
}

const res = await fetch(
  `https://api.outscraper.cloud/requests/${encodeURIComponent(requestId)}`,
  { headers: { "X-API-KEY": env.OUTSCRAPER_API_KEY } },
);
const json = await res.json();
const raw = json.data;
// Multi-Query-Requests liefern data als Array von Arrays (eins pro Query).
const perQuery = Array.isArray(raw) && Array.isArray(raw[0]) ? raw : null;
const rows = Array.isArray(raw) ? (perQuery ? raw.flat() : raw) : [];

console.log(
  JSON.stringify(
    {
      http: res.status,
      status: json.status,
      queries: perQuery ? perQuery.length : Array.isArray(raw) ? 1 : 0,
      perQueryCounts: perQuery ? perQuery.map((q) => q.length) : null,
      rows: rows.length,
      withPhone: rows.filter((p) => p.phone).length,
      withWebsite: rows.filter((p) => p.website || p.site).length,
      withEmail: rows.filter((p) => p.email).length,
      sample: rows.slice(0, 5).map((p) => ({
        query: p.query,
        name: p.name,
        phone: p.phone,
        website: p.website ?? p.site ?? null,
        postal_code: p.postal_code,
        business_status: p.business_status,
      })),
    },
    null,
    2,
  ),
);
