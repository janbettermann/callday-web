/**
 * POST /api/lists/generate — startet einen Lead-Generator-Job.
 *
 * Auth: eingeloggter User (SSR-Cookie-Session). Free-Cap (1 Gratis-Liste
 * pro Konto) wird DB-seitig vom partial unique index erzwungen — der
 * 23505-Fall wird hier in ein sauberes 409 uebersetzt.
 *
 * Der Outscraper-Webhook zeigt auf /api/lists/webhook mit Job-ID +
 * per-Job-Secret in der URL; die Ergebnisse selbst holt die Verarbeitung
 * authenticated bei Outscraper (siehe lib/lists/jobs.ts).
 */

import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  clampRequestedSize,
  ensureSignupGrant,
  getCreditBalance,
} from "@/lib/lists/credits";
import { findCountry } from "@/lib/lists/countries";
import {
  buildQueryPlan,
  computePerQueryLimit,
  MAX_LOCATIONS,
  type LocationInput,
} from "@/lib/lists/fanout";
import { getRegion } from "@/lib/lists/geo-regions";
import { startGoogleMapsSearch } from "@/lib/lists/outscraper";
import {
  WEBSITE_FILTER_MODES,
  type WebsiteFilterMode,
} from "@/lib/lists/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FIELD_MAX_LENGTH = 60;

/**
 * Freitext-Feld saeubern: Kommas/Zeilenumbrueche raus (die Query wird
 * komma-separiert an Outscraper gebaut), Whitespace normalisieren.
 */
function cleanField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[,\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= FIELD_MAX_LENGTH
    ? cleaned
    : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { industry, industryDisplay, city, country, website, maxSize, locations } =
    (body ?? {}) as Record<string, unknown>;
  const cleanIndustry = cleanField(industry);
  const countryConfig = findCountry(country);
  if (!cleanIndustry || !countryConfig) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  // Anzeige-Sprache-Split (§14b Punkt 3): industry ist der QUERY-Begriff
  // (Kanonik), industry_display der sichtbare Feldtext ("Zahnarzt") —
  // fuer BuildingView + Listenname. Fehlt er (alte Clients), ist beides
  // dasselbe.
  const cleanIndustryDisplay = cleanField(industryDisplay) ?? cleanIndustry;

  // Locations-Chips validieren (Multi-Location, §14b Punkt 5): Stadt-
  // Chips als Freitext (cleanField), State-Chips gegen das Geo-Asset
  // (region_id muss existieren UND zum Land passen). Fallback: das
  // alte Ein-Stadt-`city`-Feld (Deploy-Fenster mit altem Client).
  const rawLocations = Array.isArray(locations)
    ? locations
    : typeof city === "string"
      ? [{ name: city }]
      : [];
  const cleanLocations: LocationInput[] = [];
  for (const entry of rawLocations.slice(0, MAX_LOCATIONS)) {
    const raw = (entry ?? {}) as Record<string, unknown>;
    if (typeof raw.regionId === "string") {
      const region = getRegion(raw.regionId);
      if (!region || region.country !== countryConfig.code) {
        return Response.json({ error: "invalid_input" }, { status: 400 });
      }
      cleanLocations.push({ name: region.name, region_id: region.id });
    } else {
      const name = cleanField(raw.name);
      if (!name) {
        return Response.json({ error: "invalid_input" }, { status: 400 });
      }
      cleanLocations.push({ name });
    }
  }
  if (cleanLocations.length === 0) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const websiteFilter: WebsiteFilterMode = WEBSITE_FILTER_MODES.includes(
    website as WebsiteFilterMode,
  )
    ? (website as WebsiteFilterMode)
    : "any";

  const admin = getServerSupabase();

  // Credit-Modell Phase 1 (Migration 0052, Spec §14b): Kontostand
  // deckelt die Listengroesse; 0 Credits = kein Job. Race-frei ohne
  // Locking, weil der Ein-aktiver-Job-Index parallele Starts blockt —
  // zwischen diesem Check und der Abrechnung kann nichts dazwischen.
  await ensureSignupGrant(admin, user.id);
  const balance = await getCreditBalance(admin, user.id);
  const listSize = clampRequestedSize(maxSize, balance);
  if (listSize === null) {
    return Response.json({ error: "credits_exhausted" }, { status: 403 });
  }

  const webhookSecret = randomBytes(24).toString("base64url");

  // Query-Plan bei Job-Erstellung fixieren — die Verarbeitung liest
  // ihn aus params statt ihn zu re-deriven (§14b.1); params.city bleibt
  // als Anzeige-String (BuildingView, Listen-Name).
  const queryPlan = buildQueryPlan(
    cleanIndustry,
    cleanLocations,
    countryConfig.code,
  );
  if (queryPlan.length === 0) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const displayLocation = cleanLocations.map((l) => l.name).join(", ");
  const query = `${cleanIndustry}, ${displayLocation}`;

  const { data: job, error: insertError } = await admin
    .from("lead_gen_jobs")
    .insert({
      user_id: user.id,
      params: {
        industry: cleanIndustry,
        industry_display: cleanIndustryDisplay,
        city: displayLocation,
        country: countryConfig.code,
        website: websiteFilter,
        max_size: listSize,
        locations: cleanLocations,
        query_plan: queryPlan,
      },
      query,
      webhook_secret: webhookSecret,
      is_free: true,
    })
    .select("id")
    .single();

  if (insertError || !job) {
    if (insertError?.code === "23505") {
      // Ein-aktiver-Job-Regel (idx_lead_gen_jobs_one_active): es laeuft
      // schon eine Generierung — der Status zeigt sie.
      return Response.json({ error: "job_running" }, { status: 409 });
    }
    console.error("[lists/generate] job insert failed", insertError);
    return Response.json({ error: "job_create_failed" }, { status: 500 });
  }

  const webhookUrl = `${request.nextUrl.origin}/api/lists/webhook?job=${job.id}&secret=${webhookSecret}`;

  // Seit 2026-08-05 laeuft JEDER Markt mit language=en + Server-Filtern
  // (Jan-Entscheidung; Spec §6b/§14b): Server-Quick-Filter gibt es nur
  // bei language=en, und die A/B-Tests (Koeln/Wien/Paderborn) haben
  // belegt, dass en weder Firmen-Menge noch Adressen/Kategorien
  // verschlechtert — Adressen bleiben lokal ("Wien", nicht "Vienna").
  // Nur die working_hours-Tages-Schluessel kommen englisch; die
  // Pipeline uebersetzt sie in die Markt-Sprache. Die Client-Pipeline
  // laeuft als Garantie-Netz ohnehin immer. Der Kostenhebel: beim
  // Website-Filter (~5 % Trefferquote) werden nur Treffer geliefert
  // und berechnet statt des vollen Raw-Scans (Faktor ~20 bei
  // "without"-Kampagnen-Listen).
  const serverFilters: string[] = ["with_phone", "operational_only"];
  if (websiteFilter === "without") serverFilters.push("only_without_website");
  if (websiteFilter === "with") serverFilters.push("only_with_website");

  // Scan-Budget PRO Query aus Wunschgroesse + Plan-Groesse + Filter
  // (Formel + Begruendung: lib/lists/fanout.ts).
  const perQueryLimit = computePerQueryLimit(
    listSize,
    queryPlan.length,
    websiteFilter !== "any",
  );

  try {
    const requestId = await startGoogleMapsSearch({
      query: queryPlan.map((entry) => entry.query),
      limit: perQueryLimit,
      region: countryConfig.code,
      language: "en",
      webhookUrl,
      filters: serverFilters,
      // Ein Enricher, immer an, auch Free (§13d) — E-Mails fuer den
      // Prefill; abgerechnet pro Domain, Betriebe ohne Website gratis.
      enrichments: ["leads_n_contacts"],
    });
    await admin
      .from("lead_gen_jobs")
      .update({ outscraper_request_id: requestId })
      .eq("id", job.id);
  } catch (err) {
    console.error("[lists/generate] outscraper start failed", err);
    // failed gibt den Free-Slot wieder frei (partial index exkludiert failed).
    await admin
      .from("lead_gen_jobs")
      .update({
        status: "failed",
        error: "outscraper_start_failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return Response.json({ error: "generator_unavailable" }, { status: 502 });
  }

  return Response.json({ jobId: job.id });
}
