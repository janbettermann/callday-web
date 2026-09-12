/**
 * Job-Verwaltung des Lead-Generators (Tabelle lead_gen_jobs).
 *
 * Kernstueck ist processJobIfFinished: holt die Outscraper-Ergebnisse,
 * laesst sie durch die Pipeline und schreibt Liste + Job-Endzustand.
 * Wird von ZWEI Seiten aufgerufen — dem Outscraper-Webhook und dem
 * Status-Poll des Clients (Self-Heal fuer verlorene Webhooks + lokale
 * Dev-Umgebung, die kein oeffentliches Webhook-Ziel hat). Der Claim
 * pending→processing stellt sicher, dass nur einer verarbeitet.
 *
 * Seit dem PLZ-Tiling (Spec §14b.1) traegt ein Job seine Welle in
 * params.tiles; die Verarbeitung liefert zuerst den Spillover der
 * Branche (bezahlte, noch ungelieferte Leads frueherer Laeufe), dann die
 * Welle, und hakt die Tiles bei EMPFANG der Ergebnisse im Coverage-
 * Ledger ab. Alt-Jobs (params.query_plan) laufen unveraendert durch.
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
import { assembleDelivery, buildTileOutcome } from "./delivery";
import type { LocationInput, QueryPlanEntry } from "./fanout";
import { getRequestResults, type OutscraperResults } from "./outscraper";
import {
  buildCustomFieldDefs,
  insertGeneratedList,
  normalizePhoneKey,
  type CallableLead,
  type WebsiteFilterMode,
} from "./pipeline";
import { TILE_LIMIT_MAX, type TilePlanEntry } from "./tiles";

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
  /** Bei Erstellung fixierte Welle (§14b.1). Leer = Spillover-only-Job
   *  ohne Outscraper-Request; undefined = Alt-Job. */
  tiles?: TilePlanEntry[];
  /** Outscraper-`limit` der Welle — wird als limit_used abgehakt. */
  tile_limit?: number;
  /** Bei Erstellung fixierte Spillover-Auswahl (Rows aus Tiles DIESER
   *  Suche, Filter passend, <= max_size) — wird vor der Welle geliefert. */
  spillover_ids?: string[];
  /** Alle Kern-PLZ der Chips (Suchgebiet) — Stufe 0 der Liefer-
   *  Sortierung (pipeline.sortByAreaMatch). */
  candidate_postal_codes?: string[];
  /** Stand VOR der Welle fuer "12 of 60 areas searched so far":
   *  visited = schon einmal besucht (closed + retry), covered = erschoepft.
   *  Jobs vor 2026-09-13 haben nur covered_before. */
  coverage?: { covered_before: number; visited_before?: number; total: number };
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
 * pending-Job vom 2026-07-15. Massstab: ready-Jobs brauchten bis 09/2026
 * im Schnitt 2 min, maximal 9 min; die Verarbeitung nach dem Claim
 * dauert Sekunden, ein processing-Job ohne Update seit 5 min ist von
 * einem Function-Timeout oder Crash gekillt worden.
 */
const PENDING_TIMEOUT_MS = 30 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

function isStale(job: LeadGenJob, now = Date.now()): boolean {
  if (job.status === "pending") {
    return now - new Date(job.created_at).getTime() > PENDING_TIMEOUT_MS;
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

/**
 * Verarbeitet einen pending Job, sofern Outscraper fertig ist.
 * Idempotent + race-sicher: der Uebergang pending→processing ist der
 * Claim; wer ihn verliert, gibt den aktuellen Job-Stand zurueck.
 */
export async function processJobIfFinished(
  admin: SupabaseClient,
  job: LeadGenJob,
): Promise<LeadGenJob> {
  if (isStale(job)) return failJob(admin, job.id, "timeout");
  if (job.status !== "pending") return job;

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
    // Spillover-only (§14b.1 Punkt 6): der Spillover der Branche deckt
    // die Wunschgroesse — kein Outscraper-Request, die bezahlten Leads
    // liegen schon da.
    results = { status: "success", places: [] };
  } else {
    return job;
  }

  // VOR dem Claim laden: wirft der Fetch (transient), bleibt der Job
  // pending und der naechste Poll heilt — nach dem Claim gaebe es einen
  // unheilbaren processing-Haenger.
  const knownPhones = await fetchExistingPhoneKeys(admin, job.user_id);
  const spilloverRows = isTileJob(job)
    ? await fetchSpilloverByIds(admin, job.params.spillover_ids ?? [])
    : [];

  const { data: claimed, error: claimError } = await admin
    .from("lead_gen_jobs")
    .update({ status: "processing" })
    .eq("id", job.id)
    .eq("status", "pending")
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (claimError) throw new Error(`job claim failed: ${claimError.message}`);
  if (!claimed) return (await fetchJobById(admin, job.id)) ?? job;

  if (results.status === "failed") {
    return failJob(admin, job.id, "outscraper_failed");
  }

  // Spillover ZUERST (0 Outscraper-Kosten, zaehlt nur gegen Credits) —
  // die bei Erstellung fixierte Auswahl (Tiles dieser Suche), nochmal
  // durch Filter + Bestands-Dedupe; dann die Welle (Round-Robin, city-
  // first), Cap auf max_size, Ueberschuss zurueck. Alles pur in
  // delivery.ts — hier nur Job-Params reinreichen. Markt-Sprache nur
  // noch fuer die Tages-Namen der Oeffnungszeiten (Query laeuft seit
  // 2026-08-05 immer mit language=en, Spec §6b/§14b).
  const delivery = assembleDelivery({
    places: results.places,
    spillover: spilloverRows,
    knownPhoneKeys: knownPhones,
    maxSize: resolveStoredMaxSize(job.params.max_size),
    websiteFilter: job.params.website ?? "any",
    // Fallback-Branche ist nutzer-sichtbar (Lead-Feld) → Anzeige-Text.
    fallbackIndustry: job.params.industry_display ?? job.params.industry ?? null,
    marketLanguage: findCountry(job.params.country)?.language ?? "en",
    plan: job.params.tiles ?? job.params.query_plan,
    city: job.params.city ?? null,
    candidatePostalCodes: new Set(job.params.candidate_postal_codes ?? []),
  });
  const { leads, overflow } = delivery;

  if (isTileJob(job) && job.params.tiles!.length > 0 && results.places.length === 0) {
    Sentry.captureMessage("lead-gen wave returned no places", {
      level: "warning",
      tags: { feature: "lists-generator" },
      extra: { jobId: job.id, tiles: job.params.tiles!.length },
    });
  }

  if (leads.length === 0) {
    // Coverage trotzdem abhaken: jede Query der Welle wurde ausgefuehrt
    // (kein totalLimit), 0 Treffer sind ein echter Befund — sonst wuerde
    // jeder Folge-Lauf dieselben leeren Tiles neu scannen.
    await recordTileOutcome(
      admin,
      job,
      results,
      [],
      delivery.consumedSpilloverIds,
    );
    // raw_count auch hier: im Admin unterscheidet das "Outscraper hat
    // nichts geliefert" (0) von "Pipeline hat alles gefiltert" (>0).
    return failJob(admin, job.id, "no_results", {
      raw_count: results.places.length,
    });
  }

  const listName = buildListName(job.params, job.query);
  let listId: string;
  try {
    listId = await insertGeneratedList(admin, {
      userId: job.user_id,
      name: listName,
      leads,
      customFieldDefs: buildCustomFieldDefs(leads),
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
      raw_count: results.places.length,
      lead_count: leads.length,
      completed_at: new Date().toISOString(),
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
      deliveredCount: leads.length,
    });
  } catch (err) {
    console.error("[lists] credit charge failed", err);
    Sentry.captureException(err, { tags: { area: "lead-credits" } });
  }

  // Coverage + Spillover ebenfalls NACH der Liste: schlaegt der Insert
  // fehl, bleiben die Tiles offen (Folge-Lauf sucht erneut, Dedupe
  // filtert) — Coverage luegt nie in Richtung "abgedeckt ohne Lieferung".
  await recordTileOutcome(
    admin,
    readyJob,
    results,
    overflow,
    delivery.consumedSpilloverIds,
  );

  await sendReadyEmail(admin, readyJob, listName);
  return readyJob;
}

/**
 * Abhaken bei EMPFANG (§14b.1 Punkt 4): Coverage-Upsert fuer jedes Tile
 * der Welle (result_count = gelieferte Plaetze seiner Query, 0 ist ein
 * Befund), Ueberschuss in den Spillover, verbrauchten Spillover
 * loeschen. Die Bilanz selbst rechnet delivery.buildTileOutcome (pur);
 * hier nur die Ledger-Schluessel dazu + I/O. Fehler brechen den
 * fertigen Job nicht — sie alarmieren (Sentry error): offene Tiles
 * kosten beim naechsten Lauf Cents, eine verlorene Liste waere teurer.
 */
async function recordTileOutcome(
  admin: SupabaseClient,
  job: LeadGenJob,
  results: OutscraperResults,
  overflow: CallableLead[],
  consumedSpilloverIds: string[],
): Promise<void> {
  if (!isTileJob(job)) return;
  const ledgerKey = {
    user_id: job.user_id,
    category_canon: job.params.category_canon!,
    job_id: job.id,
  };

  try {
    const outcome = buildTileOutcome({
      tiles: job.params.tiles!,
      places: results.places,
      overflow,
      limitUsed: job.params.tile_limit ?? TILE_LIMIT_MAX,
      websiteFilter: job.params.website ?? "any",
    });
    await upsertCoverage(
      admin,
      outcome.coverage.map((row) => ({ ...ledgerKey, ...row })),
    );
    await insertSpillover(
      admin,
      outcome.spillover.map((row) => ({ ...ledgerKey, ...row })),
    );
    await deleteSpillover(admin, consumedSpilloverIds);
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
  extra: { raw_count?: number } = {},
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
