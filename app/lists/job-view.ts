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
  params: {
    industry?: string;
    city?: string;
    country?: string;
    website?: WebsiteFilterMode;
  };
  createdAt: string;
}

export interface PreviewLead {
  company_name: string;
  phone: string;
  location: string | null;
  industry: string | null;
  custom_fields?: Record<string, string>;
}

export interface StatusResponse {
  job: JobView | null;
  preview?: PreviewLead[];
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
  if (job.error === "no_results") {
    return job.params.website && job.params.website !== "any"
      ? "We couldn't find callable leads matching that website filter. Try a bigger city, or set the filter back to all businesses."
      : "We couldn't find enough callable leads for that search. Try a broader industry or a nearby bigger city.";
  }
  return "Something went wrong while building your list. Please try again.";
}
