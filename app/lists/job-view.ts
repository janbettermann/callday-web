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
  /** Coverage-Stand VOR der Welle (PLZ-Tiling, Spec §14b.1 Punkt 7). */
  coverage?: { covered_before: number; total: number };
}

/**
 * "Continuing in Köln — 12 of 90 areas covered." fuer Folge-Laeufe;
 * null beim ersten Lauf einer Branche in dem Gebiet (nichts zu
 * erklaeren). Bewusst "areas", nie "zip codes" — der User soll nichts
 * Neues lernen muessen. Geteilt zwischen BuildingView (/lists/new) und
 * der Building-Kachel auf /lists.
 */
export function coverageLine(params: JobViewParams): string | null {
  const coverage = params.coverage;
  if (!coverage || coverage.covered_before < 1 || !params.city) return null;
  return `Continuing in ${params.city} — ${coverage.covered_before} of ${coverage.total} areas covered.`;
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

export function failureMessage(job: JobView): string {
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
