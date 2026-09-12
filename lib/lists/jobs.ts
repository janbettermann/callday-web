/**
 * Job-Verwaltung des Lead-Generators (Tabelle lead_gen_jobs).
 *
 * Kernstueck ist processJobIfFinished: holt die Outscraper-Ergebnisse
 * der laufenden Welle, laesst sie durch die Pipeline und schreibt Liste +
 * Job-Endzustand — oder faehrt eine Nachschlag-Welle. Wird von ZWEI
 * Seiten aufgerufen — dem Outscraper-Webhook und dem Status-Poll des
 * Clients (Self-Heal fuer verlorene Webhooks + lokale Dev-Umgebung, die
 * kein oeffentliches Webhook-Ziel hat). Der Claim pending→processing
 * stellt sicher, dass nur einer verarbeitet.
 *
 * Seit dem PLZ-Tiling (Spec §14b.1) traegt ein Job seine Welle in
 * params.tiles; die Verarbeitung liefert zuerst den fixierten Spillover,
 * dann die Welle. Seit den Nachschlag-Wellen (Schritt 2, 2026-09-13)
 * darf ein Job bis zu MAX_WAVES Wellen fahren: liefert eine Welle
 * weniger als die Max-Groesse, warten ihre Leads im Zwischenlager
 * (staging.ts), die naechste Welle wird mit dem Restbedarf geplant, und
 * erst der Abschluss schreibt Liste, Credits, Coverage und Spillover —
 * nichts davon ist vorher irreversibel. Faellt eine spaetere Welle aus,
 * wird mit dem Stand davor abgeschlossen. Alt-Jobs (params.query_plan)
 * laufen unveraendert durch.
 */

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { ListReady } from "@/emails/list-ready";
import {
  deleteSpillover,
  fetchSpilloverByIds,
  insertSpillover,
  upsertCoverage,
} from "./coverage";
import { chargeJobDelivery, resolveStoredMaxSize } from "./credits";
import { findCountry } from "./countries";
import {
  assembleDelivery,
  buildTileOutcome,
  type TileOutcome,
} from "./delivery";
import { applyEmailEnrichment, enrichmentTargets } from "./enrichment";
import type { LocationInput, QueryPlanEntry } from "./fanout";
import {
  getEmailResults,
  getRequestResults,
  OutscraperError,
  startEmailsSearch,
  startGoogleMapsSearch,
  type OutscraperEmailResults,
  type OutscraperResults,
} from "./outscraper";
import {
  buildCustomFieldDefs,
  insertGeneratedList,
  normalizePhoneKey,
  type CallableLead,
  type WebsiteFilterMode,
} from "./pipeline";
import {
  deleteStagedLeads,
  fetchStagedLeads,
  insertStagedLeads,
} from "./staging";
import { TILE_LIMIT_MAX, type TilePlanEntry } from "./tiles";
import {
  outscraperFiltersFor,
  planNextWave,
  type PlannedWave,
} from "./wave-planner";
import {
  MAX_WAVES,
  rollupWaves,
  shouldChain,
  type WaveSummary,
} from "./waves";

export type LeadGenJobStatus = "pending" | "processing" | "ready" | "failed";

export interface LeadGenJobParams {
  /** QUERY-Begriff (englische Kanonik oder woertlicher Freitext). */
  industry?: string;
  /** Sichtbarer Feldtext ("Zahnarzt") — Anzeige + Listenname (§14b.3).
   *  Alte Jobs: undefined → industry verwenden. */
  industry_display?: string;
  /** Anzeige-String der Locations (Chips per ", " gejoint). */
  city?: string;
  country?: string;
  /** Website-Filter der Anfrage — "without" ist der Agentur-Use-Case. */
  website?: WebsiteFilterMode;
  /** Max. Listengroesse (Credit-Modell) — alte Jobs haben das Feld nicht. */
  max_size?: number;
  /** Location-Chips der Anfrage (Multi-Location, §14b Punkt 5). */
  locations?: LocationInput[];
  /** Fan-out-Plan der Jobs VOR dem Tiling (Alt-Jobs) — Basis von
   *  Interleave + City-Zuordnung. Tile-Jobs: undefined. */
  query_plan?: QueryPlanEntry[];
  /** Coverage-Schluessel der Branche (tiles.categoryCanon). Tile-Jobs. */
  category_canon?: string;
  /** Fixierter Plan der LAUFENDEN Welle (§14b.1). Leer = Spillover-only;
   *  undefined = Alt-Job. */
  tiles?: TilePlanEntry[];
  /** Outscraper-`limit` der laufenden Welle — wird als limit_used abgehakt. */
  tile_limit?: number;
  /** Fixierte Spillover-Auswahl der laufenden Welle (Rows aus Kern-Tiles
   *  DIESER Suche, Filter passend, <= Restbedarf). */
  spillover_ids?: string[];
  /** Alle Kern-PLZ der Chips (Suchgebiet) — Stufe 0 der Liefer-
   *  Sortierung (pipeline.sortByAreaMatch). */
  candidate_postal_codes?: string[];
  /** Stand VOR der laufenden Welle fuer "12 of 60 areas searched so far":
   *  visited = schon einmal besucht (closed + retry), covered = erschoepft.
   *  Jobs vor 2026-09-13 haben nur covered_before. */
  coverage?: { covered_before: number; visited_before?: number; total: number };
  /** Nachschlag-Wellen (§14b.1 Schritt 2): laufende Welle (1-basiert),
   *  Deckel, Bilanzen der fertigen Wellen. Jobs davor: undefined = eine
   *  Welle. */
  wave?: number;
  max_waves?: number;
  waves_done?: WaveSummary[];
  /** Start der laufenden Welle (ISO) — wird beim Abhaken in die Bilanz
   *  uebernommen (Phasen-Dauer). */
  wave_started_at?: string;
  /** Webhook-Ziel des Jobs — Nachschlag-Wellen starten ausserhalb eines
   *  Requests und brauchen die Origin von der Erstellung. */
  webhook_url?: string;
  /** Enricher erst bei Lieferung (Schritt 3): nach der letzten Welle
   *  liegt der Job in Phase "enrich" (outscraper_request_id = Emails-
   *  Request), alle Leads im Zwischenlager. undefined = Maps-Suche. */
  phase?: "enrich";
  enrich?: {
    /** Angefragte Website-URLs (Kostenmass: $3/1k Domains). */
    domains: number;
    request_id: string | null;
    /** Neu gefuellte E-Mail-Felder — steht nach dem Abschluss. */
    filled?: number;
    started_at?: string;
    finished_at?: string;
  };
}

export interface LeadGenJob {
  id: string;
  user_id: string;
  status: LeadGenJobStatus;
  params: LeadGenJobParams;
  query: string;
  webhook_secret: string;
  outscraper_request_id: string | null;
  list_id: string | null;
  raw_count: number | null;
  lead_count: number | null;
  error: string | null;
  is_free: boolean;
  ready_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export const JOB_COLUMNS =
  "id, user_id, status, params, query, webhook_secret, outscraper_request_id, list_id, raw_count, lead_count, error, is_free, ready_email_sent_at, created_at, updated_at";

/**
 * Haenger-Grenzen. Ohne sie sperrt ein toter Job seinen User fuer immer
 * aus dem Generator (Ein-aktiver-Job-Index) — live so passiert mit einem
 * pending-Job vom 2026-07-15. Massstab: Wellen brauchten bis 09/2026 im
 * Schnitt 1–2 min, maximal 9 min; die Verarbeitung nach dem Claim dauert
 * Sekunden, ein processing-Job ohne Update seit 5 min ist von einem
 * Function-Timeout oder Crash gekillt worden. pending zaehlt ab dem
 * letzten Update (= Start der laufenden Welle), nicht ab Job-Erstellung —
 * drei Wellen duerfen zusammen laenger als 30 min brauchen.
 */
const PENDING_TIMEOUT_MS = 30 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

function isStale(job: LeadGenJob, now = Date.now()): boolean {
  if (job.status === "pending") {
    return now - new Date(job.updated_at).getTime() > PENDING_TIMEOUT_MS;
  }
  if (job.status === "processing") {
    return now - new Date(job.updated_at).getTime() > PROCESSING_TIMEOUT_MS;
  }
  return false;
}

export function buildListName(
  params: LeadGenJobParams,
  fallback: string,
): string {
  const industry = params.industry_display ?? params.industry;
  if (industry && params.city) {
    return `${industry} – ${params.city}`;
  }
  return fallback;
}

export async function fetchJobById(
  admin: SupabaseClient,
  jobId: string,
): Promise<LeadGenJob | null> {
  const { data, error } = await admin
    .from("lead_gen_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(`lead_gen_jobs fetch failed: ${error.message}`);
  return data as LeadGenJob | null;
}

export async function fetchLatestJobForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<LeadGenJob | null> {
  const { data, error } = await admin
    .from("lead_gen_jobs")
    .select(JOB_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`lead_gen_jobs fetch failed: ${error.message}`);
  return data as LeadGenJob | null;
}

/**
 * Alle Jobs eines Users, neueste zuerst — Datengrundlage der
 * Listen-Uebersicht auf /lists.
 */
export async function fetchJobsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<LeadGenJob[]> {
  const { data, error } = await admin
    .from("lead_gen_jobs")
    .select(JOB_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`lead_gen_jobs fetch failed: ${error.message}`);
  return (data ?? []) as LeadGenJob[];
}

/** Tile-Jobs tragen ein tiles-Array; leer = Spillover-only. */
function isTileJob(job: LeadGenJob): boolean {
  return Array.isArray(job.params.tiles) && Boolean(job.params.category_canon);
}

/** Claim pending→processing; null = ein anderer Lauf war schneller. */
async function claimJob(
  admin: SupabaseClient,
  job: LeadGenJob,
): Promise<LeadGenJob | null> {
  const { data, error } = await admin
    .from("lead_gen_jobs")
    .update({ status: "processing" })
    .eq("id", job.id)
    .eq("status", "pending")
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`job claim failed: ${error.message}`);
  return (data as LeadGenJob | null) ?? null;
}

/**
 * Verarbeitet die laufende Welle eines pending Jobs, sofern Outscraper
 * fertig ist. Idempotent + race-sicher: der Uebergang pending→processing
 * ist der Claim; wer ihn verliert, gibt den aktuellen Job-Stand zurueck.
 */
export async function processJobIfFinished(
  admin: SupabaseClient,
  job: LeadGenJob,
): Promise<LeadGenJob> {
  if (isStale(job)) return abandonJob(admin, job, "timeout");
  if (job.status !== "pending") return job;
  if (job.params.phase === "enrich") return completeEnrichment(admin, job);

  let results: OutscraperResults;
  if (job.outscraper_request_id) {
    try {
      results = await getRequestResults(job.outscraper_request_id);
    } catch (err) {
      // Transient (Netz / Outscraper 5xx) — Job bleibt pending, der
      // naechste Webhook-Retry oder Status-Poll versucht es erneut.
      console.error("[lists] outscraper results fetch failed", err);
      return job;
    }
    if (results.status === "pending") return job;
  } else if (isTileJob(job) && job.params.tiles!.length === 0) {
    // Spillover-only (§14b.1 Punkt 6): der Spillover deckt den Bedarf —
    // kein Outscraper-Request, die bezahlten Leads liegen schon da.
    results = { status: "success", places: [] };
  } else {
    return job;
  }

  // VOR dem Claim laden: wirft der Fetch (transient), bleibt der Job
  // pending und der naechste Poll heilt — nach dem Claim gaebe es einen
  // unheilbaren processing-Haenger.
  const knownPhones = await fetchExistingPhoneKeys(admin, job.user_id);
  const staged = isTileJob(job) ? await fetchStagedLeads(admin, job.id) : [];
  const spilloverRows = isTileJob(job)
    ? await fetchSpilloverByIds(admin, job.params.spillover_ids ?? [])
    : [];

  const claimed = await claimJob(admin, job);
  if (!claimed) return (await fetchJobById(admin, job.id)) ?? job;

  if (results.status === "failed") {
    return abandonJob(admin, claimed, "outscraper_failed", staged);
  }

  const maxSize = resolveStoredMaxSize(claimed.params.max_size);
  const websiteFilter = claimed.params.website ?? "any";

  // Dedupe-Kette: Bestand des Accounts → Zwischenlager dieses Jobs →
  // Spillover → Welle (delivery.ts). Die Zwischenlager-Leads zaehlen wie
  // Bestand, damit Welle 2 nichts aus Welle 1 wiederholt.
  const known = new Set(knownPhones);
  for (const lead of staged) known.add(normalizePhoneKey(lead.phone));
  const delivery = assembleDelivery({
    places: results.places,
    spillover: spilloverRows,
    knownPhoneKeys: known,
    maxSize: Math.max(0, maxSize - staged.length),
    websiteFilter,
    // Fallback-Branche ist nutzer-sichtbar (Lead-Feld) → Anzeige-Text.
    fallbackIndustry:
      claimed.params.industry_display ?? claimed.params.industry ?? null,
    // Markt-Sprache nur fuer die Tages-Namen der Oeffnungszeiten.
    marketLanguage: findCountry(claimed.params.country)?.language ?? "en",
    plan: claimed.params.tiles ?? claimed.params.query_plan,
    city: claimed.params.city ?? null,
    candidatePostalCodes: new Set(claimed.params.candidate_postal_codes ?? []),
  });

  const tiles = claimed.params.tiles ?? [];
  const outcome: TileOutcome | null = isTileJob(claimed)
    ? buildTileOutcome({
        tiles,
        places: results.places,
        overflow: delivery.overflow,
        limitUsed: claimed.params.tile_limit ?? TILE_LIMIT_MAX,
        websiteFilter,
      })
    : null;

  if (isTileJob(claimed) && tiles.length > 0 && results.places.length === 0) {
    Sentry.captureMessage("lead-gen wave returned no places", {
      level: "warning",
      tags: { feature: "lists-generator" },
      extra: { jobId: claimed.id, tiles: tiles.length, wave: claimed.params.wave ?? 1 },
    });
  }

  const currentWave: WaveSummary | null = outcome
    ? {
        wave: claimed.params.wave ?? 1,
        request_id: claimed.outscraper_request_id,
        started_at: claimed.params.wave_started_at ?? claimed.created_at,
        finished_at: new Date().toISOString(),
        tiles: tiles.length,
        limit: claimed.params.tile_limit ?? 0,
        places: results.places.length,
        delivered: delivery.leads.length,
        coverage: outcome.coverage,
        consumed_spillover_ids: delivery.consumedSpilloverIds,
      }
    : null;

  const deliveredTotal = staged.length + delivery.leads.length;
  if (
    currentWave &&
    shouldChain({
      deliveredTotal,
      maxSize,
      wave: currentWave.wave,
      lastWaveDelivered: delivery.leads.length,
      maxWaves: claimed.params.max_waves ?? MAX_WAVES,
    })
  ) {
    const next = await tryPlanNextWave(admin, claimed, currentWave, deliveredTotal);
    if (next && (next.plan.tiles.length > 0 || next.spilloverIds.length > 0)) {
      return startNextWave(admin, claimed, delivery.leads, currentWave, next);
    }
  }

  return concludeWaves(admin, claimed, {
    staged,
    waveLeads: delivery.leads,
    currentWave,
    overflow: outcome?.spillover ?? [],
    rawCount: rollupWaves(claimed.params.waves_done).places + results.places.length,
  });
}

/**
 * Letzte Welle ist durch: entweder direkt abschliessen oder erst die
 * E-Mail-Suche fuer die gelieferten Betriebe starten (Schritt 3). Ohne
 * Websites (Filter "ohne Website", leere Liste) oder ohne Webhook-Ziel
 * (Alt-Jobs) gibt es nichts anzureichern.
 */
async function concludeWaves(
  admin: SupabaseClient,
  job: LeadGenJob,
  input: {
    staged: CallableLead[];
    waveLeads: CallableLead[];
    currentWave: WaveSummary | null;
    overflow: TileOutcome["spillover"];
    rawCount: number;
  },
): Promise<LeadGenJob> {
  const leads = [...input.staged, ...input.waveLeads];
  const targets =
    (job.params.website ?? "any") === "without" ? [] : enrichmentTargets(leads);
  if (leads.length === 0 || targets.length === 0 || !job.params.webhook_url) {
    return finalizeJob(admin, job, {
      leads,
      currentWave: input.currentWave,
      overflow: input.overflow,
      rawCount: input.rawCount,
    });
  }
  return startEnrichment(admin, job, input, targets);
}

/**
 * Phase "enrich": alle Leads ins Zwischenlager, Ueberschuss als bezahltes
 * Inventar in den Spillover, Bilanz der letzten Welle in die Params, Job
 * zurueck auf pending mit dem Emails-Request. Laesst sich der Request
 * nicht starten, wird ohne E-Mails abgeschlossen — die Liste ist wichtiger
 * als das Prefill.
 */
async function startEnrichment(
  admin: SupabaseClient,
  job: LeadGenJob,
  input: {
    waveLeads: CallableLead[];
    currentWave: WaveSummary | null;
    overflow: TileOutcome["spillover"];
    rawCount: number;
  },
  targets: string[],
): Promise<LeadGenJob> {
  if (input.currentWave) {
    await insertStagedLeads(admin, job.id, input.currentWave.wave, input.waveLeads);
  } else if (input.waveLeads.length > 0) {
    // Alt-Job ohne Wellen-Bilanz (kommt nicht vor, defensiv): Lager-Welle 1.
    await insertStagedLeads(admin, job.id, 1, input.waveLeads);
  }
  if (isTileJob(job) && input.overflow.length > 0) {
    await insertSpillover(
      admin,
      input.overflow.map((row) => ({
        user_id: job.user_id,
        category_canon: job.params.category_canon!,
        job_id: job.id,
        ...row,
      })),
    );
  }

  const nextParams: LeadGenJobParams = {
    ...job.params,
    waves_done: input.currentWave
      ? [...(job.params.waves_done ?? []), input.currentWave]
      : job.params.waves_done,
    phase: "enrich",
    enrich: {
      domains: targets.length,
      request_id: null,
      started_at: new Date().toISOString(),
    },
  };
  const { data: reopened, error } = await admin
    .from("lead_gen_jobs")
    .update({
      status: "pending",
      outscraper_request_id: null,
      raw_count: input.rawCount,
      params: nextParams,
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (error || !reopened) {
    // Zwischenlager ist komplett — der Reaper schliesst spaeter aus dem
    // Lager ab (abandonJob), nichts geht verloren.
    throw new Error(`job reopen for enrichment failed: ${error?.message ?? "job vanished"}`);
  }
  const reopenedJob = reopened as LeadGenJob;

  try {
    const requestId = await startEmailsSearch({
      queries: targets,
      webhookUrl: reopenedJob.params.webhook_url!,
    });
    await admin
      .from("lead_gen_jobs")
      .update({
        outscraper_request_id: requestId,
        params: {
          ...reopenedJob.params,
          enrich: { ...reopenedJob.params.enrich!, request_id: requestId },
        },
      })
      .eq("id", job.id);
    return (await fetchJobById(admin, job.id)) ?? reopenedJob;
  } catch (err) {
    console.error("[lists] enrichment start failed", err);
    Sentry.captureException(err, {
      tags: {
        feature: "lists-generator",
        outscraper_status:
          err instanceof OutscraperError ? String(err.status) : "unknown",
      },
      extra: { jobId: job.id, domains: targets.length },
    });
    return abandonJob(admin, reopenedJob, "enrich_start_failed");
  }
}

/**
 * Phase "enrich" abschliessen: Emails-Ergebnisse holen, in die
 * Zwischenlager-Leads schreiben, Liste bauen. Fehler oder leere Antwort
 * kosten nur das Prefill, nie die Liste.
 */
async function completeEnrichment(
  admin: SupabaseClient,
  job: LeadGenJob,
): Promise<LeadGenJob> {
  // Request-ID fehlt nur im Fenster zwischen Reopen und Start — warten.
  if (!job.outscraper_request_id) return job;

  let results: OutscraperEmailResults;
  try {
    results = await getEmailResults(job.outscraper_request_id);
  } catch (err) {
    console.error("[lists] emails results fetch failed", err);
    return job;
  }
  if (results.status === "pending") return job;

  const staged = await fetchStagedLeads(admin, job.id);
  const claimed = await claimJob(admin, job);
  if (!claimed) return (await fetchJobById(admin, job.id)) ?? job;

  if (results.status === "failed") {
    Sentry.captureMessage("lead-gen email enrichment failed", {
      level: "warning",
      tags: { feature: "lists-generator" },
      extra: { jobId: job.id, domains: claimed.params.enrich?.domains },
    });
  }
  const { leads, filled } = applyEmailEnrichment(staged, results.results);

  return finalizeJob(
    admin,
    {
      ...claimed,
      params: {
        ...claimed.params,
        enrich: claimed.params.enrich
          ? {
              ...claimed.params.enrich,
              filled,
              finished_at: new Date().toISOString(),
            }
          : undefined,
      },
    },
    {
      leads,
      currentWave: null,
      overflow: [],
      rawCount: claimed.raw_count ?? rollupWaves(claimed.params.waves_done).places,
    },
  );
}

/**
 * Naechste Welle planen — Fehler hier (Postal-Daten, Places, Ledger)
 * sind kein Grund, die schon gekauften Leads zu verlieren: null heisst
 * "mit dem Stand abschliessen".
 */
async function tryPlanNextWave(
  admin: SupabaseClient,
  job: LeadGenJob,
  currentWave: WaveSummary,
  deliveredTotal: number,
): Promise<PlannedWave | null> {
  const params = job.params;
  if (
    !params.industry ||
    !params.category_canon ||
    !params.country ||
    !params.locations ||
    !params.webhook_url
  ) {
    return null;
  }
  const rollup = rollupWaves(params.waves_done);
  try {
    return await planNextWave(
      admin,
      {
        userId: job.user_id,
        industry: params.industry,
        categoryCanon: params.category_canon,
        country: params.country,
        locations: params.locations,
        websiteFilter: params.website ?? "any",
        maxSize: resolveStoredMaxSize(params.max_size),
      },
      {
        deliveredSoFar: deliveredTotal,
        pendingCoverage: [...rollup.coverage, ...currentWave.coverage],
        consumedSpilloverIds: new Set([
          ...rollup.consumedSpilloverIds,
          ...currentWave.consumed_spillover_ids,
        ]),
      },
    );
  } catch (err) {
    console.error("[lists] next wave planning failed", err);
    Sentry.captureException(err, {
      tags: { feature: "lists-generator", area: "wave-planning" },
      extra: { jobId: job.id },
    });
    return null;
  }
}

/**
 * Welle N ins Zwischenlager, Welle N+1 als neuen Plan in die Params,
 * Job zurueck auf pending und den Outscraper-Request starten. Laesst
 * sich der Request nicht starten, wird mit dem Zwischenlager
 * abgeschlossen (inklusive Welle N).
 */
async function startNextWave(
  admin: SupabaseClient,
  job: LeadGenJob,
  waveLeads: CallableLead[],
  currentWave: WaveSummary,
  next: PlannedWave,
): Promise<LeadGenJob> {
  await insertStagedLeads(admin, job.id, currentWave.wave, waveLeads);

  const nextParams: LeadGenJobParams = {
    ...job.params,
    wave: currentWave.wave + 1,
    wave_started_at: new Date().toISOString(),
    tiles: next.plan.tiles,
    tile_limit: next.plan.limit,
    spillover_ids: next.spilloverIds,
    candidate_postal_codes: next.candidatePostalCodes,
    coverage: {
      covered_before: next.plan.covered,
      visited_before: next.plan.visited,
      total: next.plan.total,
    },
    waves_done: [...(job.params.waves_done ?? []), currentWave],
  };
  const { data: reopened, error } = await admin
    .from("lead_gen_jobs")
    .update({ status: "pending", outscraper_request_id: null, params: nextParams })
    .eq("id", job.id)
    .eq("status", "processing")
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (error || !reopened) {
    // Zwischenlager ist geschrieben — der Reaper schliesst spaeter aus
    // dem Lager ab (abandonJob), nichts geht verloren.
    throw new Error(`job reopen failed: ${error?.message ?? "job vanished"}`);
  }
  const reopenedJob = reopened as LeadGenJob;

  if (next.plan.tiles.length === 0) {
    // Nachschlag rein aus Spillover — sofort verarbeiten.
    return processJobIfFinished(admin, reopenedJob);
  }

  try {
    const requestId = await startGoogleMapsSearch({
      query: next.plan.tiles.map((tile) => tile.query),
      limit: next.plan.limit,
      region: reopenedJob.params.country ?? "DE",
      language: "en",
      webhookUrl: reopenedJob.params.webhook_url!,
      filters: outscraperFiltersFor(reopenedJob.params.website ?? "any"),
    });
    await admin
      .from("lead_gen_jobs")
      .update({ outscraper_request_id: requestId })
      .eq("id", job.id);
    return (await fetchJobById(admin, job.id)) ?? reopenedJob;
  } catch (err) {
    console.error("[lists] next wave start failed", err);
    Sentry.captureException(err, {
      tags: {
        feature: "lists-generator",
        outscraper_status:
          err instanceof OutscraperError ? String(err.status) : "unknown",
      },
      extra: { jobId: job.id, wave: reopenedJob.params.wave },
    });
    return abandonJob(admin, reopenedJob, "outscraper_start_failed");
  }
}

/**
 * Welle ausgefallen (Timeout, Outscraper-Fehler, Start unmoeglich):
 * liegt schon etwas im Zwischenlager, wird damit abgeschlossen — der
 * Nutzer bekommt die Liste aus den fertigen Wellen statt gar nichts.
 * Sonst failed der Job wie bisher.
 */
async function abandonJob(
  admin: SupabaseClient,
  job: LeadGenJob,
  reason: string,
  stagedHint?: CallableLead[],
): Promise<LeadGenJob> {
  const staged =
    stagedHint ?? (isTileJob(job) ? await fetchStagedLeads(admin, job.id) : []);
  if (staged.length === 0) return failJob(admin, job.id, reason);

  let current = job;
  if (current.status === "pending") {
    const claimed = await claimJob(admin, current);
    if (!claimed) return (await fetchJobById(admin, job.id)) ?? job;
    current = claimed;
  }
  if (current.status !== "processing") return current;

  Sentry.captureMessage(`lead-gen job finished early: ${reason}`, {
    level: "warning",
    tags: { feature: "lists-generator" },
    extra: { jobId: job.id, wave: current.params.wave, staged: staged.length },
  });
  return finalizeJob(admin, current, {
    leads: staged,
    currentWave: null,
    overflow: [],
    rawCount: current.raw_count ?? rollupWaves(current.params.waves_done).places,
  });
}

/**
 * Abschluss: EINE Liste aus allen Wellen, Ready, Credits, dann der
 * Ledger (Coverage aller Wellen, Spillover der letzten, verbrauchter
 * Spillover) und das Zwischenlager. Ohne Leads: Coverage trotzdem
 * abhaken (0 Treffer sind ein Befund) und no_results.
 */
async function finalizeJob(
  admin: SupabaseClient,
  job: LeadGenJob,
  input: {
    leads: CallableLead[];
    currentWave: WaveSummary | null;
    overflow: TileOutcome["spillover"];
    rawCount: number;
  },
): Promise<LeadGenJob> {
  const wavesDone = input.currentWave
    ? [...(job.params.waves_done ?? []), input.currentWave]
    : (job.params.waves_done ?? []);
  const rollup = rollupWaves(wavesDone);

  if (input.leads.length === 0) {
    await writeLedger(admin, job, {
      coverage: rollup.coverage,
      spillover: [],
      consumedSpilloverIds: rollup.consumedSpilloverIds,
    });
    // raw_count auch hier: im Admin unterscheidet das "Outscraper hat
    // nichts geliefert" (0) von "Pipeline hat alles gefiltert" (>0).
    return failJob(admin, job.id, "no_results", {
      raw_count: input.rawCount,
      params: { ...job.params, waves_done: wavesDone },
    });
  }

  const listName = buildListName(job.params, job.query);
  let listId: string;
  try {
    listId = await insertGeneratedList(admin, {
      userId: job.user_id,
      name: listName,
      leads: input.leads,
      customFieldDefs: buildCustomFieldDefs(input.leads),
    });
  } catch (err) {
    console.error("[lists] list insert failed", err);
    return failJob(admin, job.id, "insert_failed");
  }

  const { data: ready, error: readyError } = await admin
    .from("lead_gen_jobs")
    .update({
      status: "ready",
      list_id: listId,
      raw_count: input.rawCount,
      lead_count: input.leads.length,
      completed_at: new Date().toISOString(),
      params: { ...job.params, waves_done: wavesDone },
    })
    .eq("id", job.id)
    .select(JOB_COLUMNS)
    .single();
  if (readyError || !ready) {
    throw new Error(`job ready update failed: ${readyError?.message}`);
  }
  const readyJob = ready as LeadGenJob;

  // Credits abrechnen — NACH dem Ready-Update: schlaegt hier etwas
  // fehl, hat der User im Zweifel eine unberechnete Liste (kulant),
  // nie eine berechnete Nicht-Liste. Idempotent pro Job; Fehler laut
  // loggen statt den fertigen Job zu kippen.
  try {
    await chargeJobDelivery(admin, {
      userId: readyJob.user_id,
      jobId: readyJob.id,
      deliveredCount: input.leads.length,
    });
  } catch (err) {
    console.error("[lists] credit charge failed", err);
    Sentry.captureException(err, { tags: { area: "lead-credits" } });
  }

  // Ledger ebenfalls NACH der Liste: schlaegt der Insert fehl, bleiben
  // die Tiles offen (Folge-Lauf sucht erneut, Dedupe filtert) — Coverage
  // luegt nie in Richtung "abgedeckt ohne Lieferung".
  await writeLedger(admin, readyJob, {
    coverage: rollup.coverage,
    spillover: input.overflow,
    consumedSpilloverIds: rollup.consumedSpilloverIds,
  });

  await sendReadyEmail(admin, readyJob, listName);
  return readyJob;
}

/**
 * Abhaken bei EMPFANG, geschrieben beim Abschluss (§14b.1 Punkt 4):
 * Coverage-Upsert aller Wellen (result_count = gelieferte Plaetze der
 * Query, 0 ist ein Befund), Ueberschuss in den Spillover, verbrauchten
 * Spillover und das Zwischenlager loeschen. Fehler brechen den fertigen
 * Job nicht — sie alarmieren (Sentry error): offene Tiles kosten beim
 * naechsten Lauf Cents, eine verlorene Liste waere teurer.
 */
async function writeLedger(
  admin: SupabaseClient,
  job: LeadGenJob,
  input: {
    coverage: TileOutcome["coverage"];
    spillover: TileOutcome["spillover"];
    consumedSpilloverIds: string[];
  },
): Promise<void> {
  if (!isTileJob(job)) return;
  const ledgerKey = {
    user_id: job.user_id,
    category_canon: job.params.category_canon!,
    job_id: job.id,
  };
  try {
    await upsertCoverage(
      admin,
      input.coverage.map((row) => ({ ...ledgerKey, ...row })),
    );
    await insertSpillover(
      admin,
      input.spillover.map((row) => ({ ...ledgerKey, ...row })),
    );
    await deleteSpillover(admin, input.consumedSpilloverIds);
    await deleteStagedLeads(admin, job.id);
  } catch (err) {
    console.error("[lists] coverage/spillover update failed", err);
    Sentry.captureException(err, {
      tags: { feature: "lists-generator", area: "coverage" },
      extra: { jobId: job.id },
    });
  }
}

const PHONE_FETCH_PAGE = 1000;

/**
 * Alle Telefon-Schluessel der bestehenden Listen eines Accounts —
 * Grundlage des Bestands-Dedupe. Beta-Skala (wenige tausend Leads pro
 * Account) vertraegt den Voll-Fetch locker; mit dem Coverage-Ledger
 * wird das feiner. Fehler werfen bewusst: lieber ein heilbarer
 * pending-Job als eine Liste voller Dubletten.
 */
async function fetchExistingPhoneKeys(
  admin: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data: lists, error: listsError } = await admin
    .from("lead_lists")
    .select("id")
    .eq("user_id", userId);
  if (listsError) {
    throw new Error(`lead_lists fetch failed: ${listsError.message}`);
  }
  const listIds = (lists ?? []).map((row) => row.id);
  if (listIds.length === 0) return new Set();

  // PostgREST liefert hoechstens 1000 Rows pro Request (Supabase-Default)
  // — ohne Seiten sah der Dedupe bei Accounts ueber 1000 Leads nur die
  // ersten 1000 und liess Dubletten durch (live: 1034 Leads bei einem
  // Test-Account). Ab ein paar tausend Leads lohnt eine RPC, die
  // serverseitig gegen die Kandidaten matcht.
  const keys = new Set<string>();
  for (let from = 0; ; from += PHONE_FETCH_PAGE) {
    const { data: leads, error: leadsError } = await admin
      .from("leads")
      .select("phone")
      .in("list_id", listIds)
      .order("id")
      .range(from, from + PHONE_FETCH_PAGE - 1);
    if (leadsError) {
      throw new Error(`leads phone fetch failed: ${leadsError.message}`);
    }
    const rows = leads ?? [];
    for (const row of rows) {
      if (typeof row.phone === "string" && row.phone) {
        keys.add(normalizePhoneKey(row.phone));
      }
    }
    if (rows.length < PHONE_FETCH_PAGE) break;
  }
  keys.delete("");
  return keys;
}

async function failJob(
  admin: SupabaseClient,
  jobId: string,
  message: string,
  extra: { raw_count?: number; params?: LeadGenJobParams } = {},
): Promise<LeadGenJob> {
  // Nur aktive Jobs kippen: hat ein paralleler Lauf (Webhook vs. Poll)
  // den Job inzwischen auf ready gebracht, bleibt das stehen.
  const { data, error } = await admin
    .from("lead_gen_jobs")
    .update({
      status: "failed",
      error: message,
      completed_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", jobId)
    .in("status", ["pending", "processing"])
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (error) {
    throw new Error(`job fail update failed: ${error.message}`);
  }
  if (!data) {
    const current = await fetchJobById(admin, jobId);
    if (!current) throw new Error("job fail update failed: job vanished");
    return current;
  }
  // Failed Jobs sollen aktiv alarmieren, nicht nur in der Admin-Tabelle
  // liegen — bewusst ohne Query/Nutzerdaten, nur Fehlercode + Job-Ref.
  // no_results ist User-Verhalten (Nonsense-Branche, leere Nische), kein
  // Defekt: eigene Message + warning, damit es weder das Errors-Board
  // noch die Alert-Mails fuellt (anderer Fingerprint als das alte
  // error-Issue). timeout / insert_failed / outscraper_failed bleiben error.
  const isNoResults = message === "no_results";
  Sentry.captureMessage(
    isNoResults
      ? "lead-gen job ended without results"
      : `lead-gen job failed: ${message}`,
    {
      level: isNoResults ? "warning" : "error",
      tags: { feature: "lists-generator" },
      extra: { jobId },
    },
  );
  return data as LeadGenJob;
}

/**
 * "Liste ist fertig"-Mail — best effort, Failures brechen den Job nicht
 * (die Liste ist da, die Mail ist Re-Engagement). Log in email_logs als
 * 'custom' (application_id-frei), Sende-Zeitpunkt am Job.
 */
async function sendReadyEmail(
  admin: SupabaseClient,
  job: LeadGenJob,
  listName: string,
): Promise<void> {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error("[lists] RESEND_API_KEY missing — ready email skipped");
      return;
    }

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(job.user_id);
    const email = userData?.user?.email;
    if (userError || !email) {
      console.error("[lists] ready email skipped — no user email", userError);
      return;
    }

    const leadCount = job.lead_count ?? 0;
    const resend = new Resend(resendKey);
    const sendResult = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [email],
      replyTo: "hello@callday.io",
      subject: `Your list is ready — ${leadCount} callable leads`,
      react: ListReady({ listName, leadCount }),
    });

    await admin.from("email_logs").insert({
      email_type: "custom",
      resend_email_id: sendResult.data?.id ?? null,
      status: sendResult.error ? "failed" : "sent",
      error_message: sendResult.error?.message ?? null,
    });

    if (!sendResult.error) {
      await admin
        .from("lead_gen_jobs")
        .update({ ready_email_sent_at: new Date().toISOString() })
        .eq("id", job.id);
    }
  } catch (err) {
    console.error("[lists] ready email failed", err);
  }
}
