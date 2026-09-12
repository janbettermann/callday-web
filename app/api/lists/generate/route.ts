/**
 * POST /api/lists/generate — startet einen Lead-Generator-Job.
 *
 * Auth: eingeloggter User (SSR-Cookie-Session). Ein-aktiver-Job-Regel
 * wird DB-seitig vom partial unique index erzwungen — der 23505-Fall
 * wird hier in ein sauberes 409 uebersetzt.
 *
 * Seit dem PLZ-Tiling (Spec §14b.1) wird hier die WELLE geplant: Chips →
 * Staedte → PLZ-Tiles (geo-data.ts), Coverage-Abgleich, Spillover-Stand,
 * Tile-Auswahl (tiles.planWave). Der Plan wird in params.tiles fixiert —
 * die Verarbeitung (lib/lists/jobs.ts) re-derivt nichts.
 *
 * Der Outscraper-Webhook zeigt auf /api/lists/webhook mit Job-ID +
 * per-Job-Secret in der URL; die Ergebnisse selbst holt die Verarbeitung
 * authenticated bei Outscraper.
 */

import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import { fetchCoverage, fetchSpillover } from "@/lib/lists/coverage";
import {
  clampRequestedSize,
  ensureSignupGrant,
  getCreditBalance,
} from "@/lib/lists/credits";
import { findCountry } from "@/lib/lists/countries";
import {
  expandLocations,
  MAX_LOCATIONS,
  type LocationInput,
} from "@/lib/lists/fanout";
import { resolveCityTiles } from "@/lib/lists/geo-data";
import { getRegion } from "@/lib/lists/geo-regions";
import { interleave } from "@/lib/lists/interleave";
import {
  JOB_COLUMNS,
  processJobIfFinished,
  type LeadGenJob,
} from "@/lib/lists/jobs";
import { OutscraperError, startGoogleMapsSearch } from "@/lib/lists/outscraper";
import {
  WEBSITE_FILTER_MODES,
  type WebsiteFilterMode,
} from "@/lib/lists/pipeline";
import {
  categoryCanon,
  planWave,
  selectSpillover,
  spilloverEligibleTiles,
  type ChipCandidates,
  type TileCandidate,
} from "@/lib/lists/tiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FIELD_MAX_LENGTH = 60;
/** Google-Place-IDs: URL-sichere Zeichen, live ~27 Zeichen. */
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{5,300}$/;

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
  // Chips als Freitext (cleanField) plus optionale Places-ID (Schluessel
  // der Viewport-Aufloesung), State-Chips gegen das Geo-Asset (region_id
  // muss existieren UND zum Land passen). Fallback: das alte Ein-Stadt-
  // `city`-Feld (Deploy-Fenster mit altem Client).
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
      const placeId =
        typeof raw.placeId === "string" && PLACE_ID_PATTERN.test(raw.placeId)
          ? raw.placeId
          : undefined;
      cleanLocations.push(placeId ? { name, place_id: placeId } : { name });
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

  const targets = expandLocations(cleanLocations, countryConfig.code);
  if (targets.length === 0) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const canon = categoryCanon(cleanIndustry);
  const displayLocation = cleanLocations.map((l) => l.name).join(", ");

  // Welle planen (§14b.1 Punkte 1–3): Tiles pro Chip — ein Stadt-Chip
  // bringt seine PLZ-Tiles, ein State-Chip zieht Round-Robin ueber die
  // Tiles seiner Top-Staedte (Fairness auch innerhalb des Chips).
  let chips: ChipCandidates[];
  let coverage;
  let spilloverRows;
  try {
    const tileLists = await Promise.all(
      targets.map((target) =>
        resolveCityTiles(admin, {
          industry: cleanIndustry,
          country: countryConfig.code,
          target,
        }),
      ),
    );
    const byLocation = new Map<string, TileCandidate[][]>();
    targets.forEach((target, index) => {
      const lists = byLocation.get(target.location) ?? [];
      lists.push(tileLists[index]);
      byLocation.set(target.location, lists);
    });
    chips = [...byLocation].map(([location, lists]) => ({
      location,
      tiles: interleave(lists),
    }));
    [coverage, spilloverRows] = await Promise.all([
      fetchCoverage(admin, user.id, canon),
      fetchSpillover(admin, user.id, canon),
    ]);
  } catch (err) {
    console.error("[lists/generate] wave planning failed", err);
    Sentry.captureException(err, {
      tags: { feature: "lists-generator", area: "tiling" },
    });
    return Response.json({ error: "job_create_failed" }, { status: 500 });
  }

  // Spillover zaehlt ZUERST gegen die Wunschgroesse — nur Rows aus
  // Kern-Tiles DIESER Suche (Rand-Tiles erst, wenn der Kern durch ist)
  // und mit passendem Filter (tiles.selectSpillover); die Welle deckt den
  // Rest. Die Auswahl wird wie die Welle fixiert.
  const spilloverPick = selectSpillover(
    spilloverRows,
    spilloverEligibleTiles(chips, coverage, websiteFilter),
    websiteFilter,
    listSize,
  );
  // Suchgebiet fuer die Liefer-Sortierung: alle Kern-PLZ der Chips, nicht
  // nur die der Welle — ein Treffer im Nachbar-Tile derselben Stadt
  // gehoert dazu, ein Huerther Treffer einer Koeln-Query oder ein
  // "Springfield NJ" in einer Missouri-Suche nicht.
  const candidatePostalCodes = [
    ...new Set(
      chips.flatMap((chip) =>
        chip.tiles.flatMap((tile) =>
          tile.core && tile.postal_code ? [tile.postal_code] : [],
        ),
      ),
    ),
  ];
  const wave = planWave({
    chips,
    coverage,
    filter: websiteFilter,
    needed: listSize - spilloverPick.length,
  });

  if (wave.open === 0 && spilloverPick.length === 0) {
    // Alles abgehakt (§14b.1 Punkt 7): klare Ansage statt Leer-Liste.
    // Wort "areas"/Staedte, nie "zip codes" — der User soll nichts Neues
    // lernen.
    return Response.json(
      {
        error: "area_covered",
        message: `You've already covered all of ${displayLocation} for ${cleanIndustryDisplay}. Try a nearby city or another industry.`,
      },
      { status: 422 },
    );
  }

  const webhookSecret = randomBytes(24).toString("base64url");
  const query = `${cleanIndustry}, ${displayLocation}`;

  const { data: job, error: insertError } = await admin
    .from("lead_gen_jobs")
    .insert({
      user_id: user.id,
      params: {
        industry: cleanIndustry,
        industry_display: cleanIndustryDisplay,
        // Anzeige-String (BuildingView, Listen-Name).
        city: displayLocation,
        country: countryConfig.code,
        website: websiteFilter,
        max_size: listSize,
        locations: cleanLocations,
        category_canon: canon,
        tiles: wave.tiles,
        tile_limit: wave.limit,
        spillover_ids: spilloverPick.map((row) => row.id),
        candidate_postal_codes: candidatePostalCodes,
        coverage: {
          covered_before: wave.covered,
          visited_before: wave.visited,
          total: wave.total,
        },
      },
      query,
      webhook_secret: webhookSecret,
      is_free: true,
    })
    .select(JOB_COLUMNS)
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

  if (wave.tiles.length === 0) {
    // Spillover-only: der Spillover deckt die Wunschgroesse — kein
    // Outscraper-Request, die Liste entsteht sofort aus bezahlten Leads.
    // Faellt das hier durch, heilt der Status-Poll (pending + leere
    // tiles = derselbe Pfad).
    try {
      await processJobIfFinished(admin, job as LeadGenJob);
    } catch (err) {
      console.error("[lists/generate] spillover-only processing failed", err);
    }
    return Response.json({ jobId: job.id });
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

  try {
    const requestId = await startGoogleMapsSearch({
      // EIN Request fuer die ganze Welle, ein Limit pro Tile (§14b.1
      // Punkt 3; kein totalLimit — sonst waere "nicht erreicht" von
      // "0 Treffer" nicht unterscheidbar, §6b).
      query: wave.tiles.map((tile) => tile.query),
      limit: wave.limit,
      region: countryConfig.code,
      language: "en",
      webhookUrl,
      filters: serverFilters,
      // E-Mail-Enricher (§13d), abgerechnet pro Domain — aber NICHT bei
      // "ohne Website": Outscraper liefert mit only_without_website +
      // leads_n_contacts 0 Records (Sonde 2026-09-11: Filter allein 2/40,
      // mit Enricher 0/40). Der Enricher haengt an der Domain und wirft
      // domain-lose Treffer weg; ohne Website gibt es eh keine zu finden.
      enrichments: websiteFilter === "without" ? [] : ["leads_n_contacts"],
    });
    await admin
      .from("lead_gen_jobs")
      .update({ outscraper_request_id: requestId })
      .eq("id", job.id);
  } catch (err) {
    console.error("[lists/generate] outscraper start failed", err);
    // Aktiv alarmieren: 401 heisst Outscraper-Kontingent leer — dann ist
    // der Generator fuer ALLE User tot, bis Guthaben nachgeladen ist.
    Sentry.captureException(err, {
      tags: {
        feature: "lists-generator",
        outscraper_status:
          err instanceof OutscraperError ? String(err.status) : "unknown",
      },
    });
    // failed gibt den Job-Slot wieder frei (partial index exkludiert failed).
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
