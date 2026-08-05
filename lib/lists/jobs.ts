/**
 * Job-Verwaltung des Lead-Generators (Tabelle lead_gen_jobs).
 *
 * Kernstueck ist processJobIfFinished: holt die Outscraper-Ergebnisse,
 * laesst sie durch die Pipeline und schreibt Liste + Job-Endzustand.
 * Wird von ZWEI Seiten aufgerufen — dem Outscraper-Webhook und dem
 * Status-Poll des Clients (Self-Heal fuer verlorene Webhooks + lokale
 * Dev-Umgebung, die kein oeffentliches Webhook-Ziel hat). Der Claim
 * pending→processing stellt sicher, dass nur einer verarbeitet.
 */

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { ListReady } from "@/emails/list-ready";
import { chargeJobDelivery, resolveStoredMaxSize } from "./credits";
import { findCountry } from "./countries";
import type { LocationInput, QueryPlanEntry } from "./fanout";
import { getRequestResults } from "./outscraper";
import {
  buildCustomFieldDefs,
  filterByWebsite,
  filterKnownPhones,
  insertGeneratedList,
  normalizePhoneKey,
  orderForDelivery,
  toCallableLeads,
  type WebsiteFilterMode,
} from "./pipeline";

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
  /** Bei Erstellung fixierter Fan-out-Plan — Basis von Interleave +
   *  City-Zuordnung in der Verarbeitung. Alte Jobs: undefined. */
  query_plan?: QueryPlanEntry[];
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
}

const JOB_COLUMNS =
  "id, user_id, status, params, query, webhook_secret, outscraper_request_id, list_id, raw_count, lead_count, error, is_free, ready_email_sent_at, created_at";

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
 * Listen-Uebersicht auf /lists. Beim Free-Cap 1 sind das heute
 * maximal eine Handvoll Rows (Fails + die eine Liste); mit den
 * Abo-Credits (Spec §10) waechst die Liste organisch weiter.
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

/**
 * Verarbeitet einen pending Job, sofern Outscraper fertig ist.
 * Idempotent + race-sicher: der Uebergang pending→processing ist der
 * Claim; wer ihn verliert, gibt den aktuellen Job-Stand zurueck.
 */
export async function processJobIfFinished(
  admin: SupabaseClient,
  job: LeadGenJob,
): Promise<LeadGenJob> {
  if (job.status !== "pending" || !job.outscraper_request_id) return job;

  let results: Awaited<ReturnType<typeof getRequestResults>>;
  try {
    results = await getRequestResults(job.outscraper_request_id);
  } catch (err) {
    // Transient (Netz / Outscraper 5xx) — Job bleibt pending, der
    // naechste Webhook-Retry oder Status-Poll versucht es erneut.
    console.error("[lists] outscraper results fetch failed", err);
    return job;
  }
  if (results.status === "pending") return job;

  // VOR dem Claim laden: wirft der Fetch (transient), bleibt der Job
  // pending und der naechste Poll heilt — nach dem Claim gaebe es einen
  // unheilbaren processing-Haenger.
  const knownPhones = await fetchExistingPhoneKeys(admin, job.user_id);

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

  // Markt-Sprache nur noch fuer die Tages-Namen der Oeffnungszeiten —
  // die Outscraper-Query selbst laeuft seit 2026-08-05 immer mit
  // language=en (Server-Filter, Spec §6b/§14b).
  const marketLanguage = findCountry(job.params.country)?.language ?? "en";
  const callable = toCallableLeads(
    results.places,
    // Fallback-Branche ist nutzer-sichtbar (Lead-Feld) → Anzeige-Text.
    job.params.industry_display ?? job.params.industry ?? null,
    marketLanguage,
  );
  const filtered = filterByWebsite(callable, job.params.website ?? "any");

  // Bestands-Dedupe: was der Account schon in irgendeiner Liste hat,
  // kommt nicht nochmal rein (und kostet keine Credits) — Vorstufe des
  // Coverage-Ledgers, bleibt danach als Garantie-Netz (§14b.1).
  const fresh = filterKnownPhones(filtered, knownPhones);

  const leads = orderForDelivery(
    fresh,
    job.params.query_plan,
    job.params.city ?? null,
  ).slice(0, resolveStoredMaxSize(job.params.max_size));
  if (leads.length === 0) {
    return failJob(admin, job.id, "no_results");
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

  await sendReadyEmail(admin, readyJob, listName);
  return readyJob;
}

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

  const { data: leads, error: leadsError } = await admin
    .from("leads")
    .select("phone")
    .in("list_id", listIds);
  if (leadsError) {
    throw new Error(`leads phone fetch failed: ${leadsError.message}`);
  }
  const keys = new Set<string>();
  for (const row of leads ?? []) {
    if (typeof row.phone === "string" && row.phone) {
      keys.add(normalizePhoneKey(row.phone));
    }
  }
  keys.delete("");
  return keys;
}

async function failJob(
  admin: SupabaseClient,
  jobId: string,
  message: string,
): Promise<LeadGenJob> {
  // Failed Jobs sollen aktiv alarmieren, nicht nur in der Admin-Tabelle
  // liegen — bewusst ohne Query/Nutzerdaten, nur Fehlercode + Job-Ref.
  Sentry.captureMessage(`lead-gen job failed: ${message}`, {
    level: "error",
    tags: { feature: "lists-generator" },
    extra: { jobId },
  });
  const { data, error } = await admin
    .from("lead_gen_jobs")
    .update({
      status: "failed",
      error: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select(JOB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`job fail update failed: ${error?.message}`);
  }
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
