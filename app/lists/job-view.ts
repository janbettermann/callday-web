/**
 * Client-seitige View-Typen des Listen-Generators + Status-Fetch.
 *
 * Das ist die Form, die /api/lists/status ausliefert (siehe Route) —
 * geteilt zwischen Generator (/lists/new), Listen-Uebersicht (/lists,
 * Building-Poll) und allem, was kuenftig Job-Zustand anzeigen will.
 * Bewusst OHNE Server-Felder (webhook_secret etc.).
 */

import type { WebsiteFilterMode } from "@/lib/lists/pipeline";

export type JobStatus = "pending" | "processing" | "ready" | "failed";

export interface JobView {
  id: string;
  status: JobStatus;
  error: string | null;
  leadCount: number | null;
  listId: string | null;
  listName: string | null;
  params: JobViewParams;
  createdAt: string;
}

export interface JobViewParams {
  industry?: string;
  /** Sichtbarer Feldtext ("Zahnarzt") — fuer Anzeigen bevorzugen. */
  industry_display?: string;
  city?: string;
  country?: string;
  website?: WebsiteFilterMode;
  max_size?: number;
  /** Coverage-Stand VOR der Welle (PLZ-Tiling, Spec §14b.1 Punkt 7);
   *  visited_before fehlt bei Jobs vor 2026-09-13. */
  coverage?: { covered_before: number; visited_before?: number; total: number };
  /** Nachschlag-Wellen (Schritt 2): laufende Welle, Deckel, fertige Wellen. */
  wave?: number;
  max_waves?: number;
  waves_done?: Array<{ wave: number; delivered: number }>;
  /** Enricher erst bei Lieferung (Schritt 3): E-Mail-Suche laeuft. */
  phase?: "enrich";
  enrich?: { domains: number };
}

/**
 * Fortschritts-Zeile jenseits der ersten Welle — null, solange es nichts
 * zu erklaeren gibt. Der Nutzer soll sehen, dass die Liste noch
 * aufgefuellt bzw. angereichert wird, nicht dass sie "haengt":
 *   - "Round 2 of up to 3 — 12 leads so far, searching more areas."
 *   - "Leads found — looking up email addresses now."
 * Baustein von statusLine (Building-Kachel auf /lists).
 */
export function waveLine(params: JobViewParams): string | null {
  if (params.phase === "enrich") {
    const soFar = (params.waves_done ?? []).reduce(
      (sum, done) => sum + done.delivered,
      0,
    );
    return soFar > 0
      ? `${soFar} leads found — looking up email addresses now.`
      : "Leads found — looking up email addresses now.";
  }
  const wave = params.wave ?? 1;
  if (wave <= 1) return null;
  const soFar = (params.waves_done ?? []).reduce(
    (sum, done) => sum + done.delivered,
    0,
  );
  const maxWaves = params.max_waves ?? wave;
  return `Round ${wave} of up to ${maxWaves} — ${soFar} leads so far, searching more areas.`;
}

/**
 * "Continuing in Köln — 12 of 60 areas searched so far." fuer
 * Folge-Laeufe; null beim ersten Lauf einer Branche in dem Gebiet (nichts
 * zu erklaeren). Zaehlt BESUCHTE Gebiete, nicht erschoepfte: seit dem
 * Bedarfs-Einkauf schliessen dichte Tiles selten beim ersten Besuch, die
 * Zahl der erschoepften saehe nach Stillstand aus. Bewusst "areas", nie
 * "zip codes" — der User soll nichts Neues lernen muessen.
 */
export function coverageLine(params: JobViewParams): string | null {
  const coverage = params.coverage;
  if (!coverage || !params.city) return null;
  const visited = coverage.visited_before ?? coverage.covered_before;
  if (visited < 1) return null;
  return `Continuing in ${params.city} — ${visited} of ${coverage.total} areas searched so far.`;
}

/**
 * DIE eine Statuszeile der Building-Kachel (Jan 2026-09-13, Zwischen-
 * screen auf /lists/new abgeschafft): ehrlich aus den Job-Params, keine
 * simulierten Stufen. Prioritaet = was gerade wirklich passiert:
 *   1. E-Mail-Suche laeuft (phase enrich)
 *   2. Nachschlag-Welle (wave >= 2)
 *   3. Folge-Lauf derselben Branche (Coverage)
 *   4. erste Welle: "Scanning Google Maps in Köln…"
 */
export function statusLine(params: JobViewParams): string {
  return (
    waveLine(params) ??
    coverageLine(params) ??
    `Scanning Google Maps in ${params.city ?? "your area"}…`
  );
}

/** Credit-Kontostand (Phase 1: nur Signup-Credits; Abo-Grants mit IAP). */
export interface CreditsView {
  balance: number;
  signupTotal: number;
}

export interface StatusResponse {
  job: JobView | null;
  credits?: CreditsView;
}

export async function fetchJobStatus(jobId?: string): Promise<StatusResponse> {
  const suffix = jobId ? `?job=${jobId}` : "";
  const response = await fetch(`/api/lists/status${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return (await response.json()) as StatusResponse;
}

/** Nutzer-Text zu einem failed Job — reicht error + params (auch Server-Rows). */
export function failureMessage(job: Pick<JobView, "error" | "params">): string {
  if (job.error === "timeout") {
    return "That one took too long and we stopped it — no credits were used. Please try again.";
  }
  if (job.error === "no_results") {
    return job.params.website && job.params.website !== "any"
      ? "We couldn't find callable leads matching that website filter. Try a bigger city, or set the filter back to all businesses."
      : "We couldn't find enough callable leads for that search. Try a broader industry or a nearby bigger city.";
  }
  return "Something went wrong while building your list. Please try again.";
}
