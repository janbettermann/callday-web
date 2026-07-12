import "server-only";

import { getServerSupabase } from "../supabase-server";
import type { LeadGenJobParams } from "../lists/jobs";

/**
 * Admin-Queries fuer den Listen-Generator (lead_gen_jobs) —
 * service_role, server-only. Observability-Minimalform: failed Jobs
 * sichtbar machen + Outscraper-Verbrauch grob beziffern, bevor eine
 * bezahlte Kampagne Traffic auf den Generator schickt.
 */

export interface LeadGenJobRow {
  id: string;
  status: "pending" | "processing" | "ready" | "failed";
  params: LeadGenJobParams;
  query: string;
  raw_count: number | null;
  lead_count: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  user_email: string | null;
}

export interface LeadGenStats {
  total: number;
  ready: number;
  failed: number;
  pending: number;
  /** Summe gelieferter Outscraper-Records (= Abrechnungseinheit). */
  rawRecords: number;
  deliveredLeads: number;
  /** Grobe Outscraper-Kosten in USD ($3 / 1.000 Records, Medium-Tier). */
  estimatedSpendUsd: number;
}

const JOB_COLUMNS =
  "id, user_id, status, params, query, raw_count, lead_count, error, created_at, completed_at";

interface RawJob {
  id: string;
  user_id: string;
  status: LeadGenJobRow["status"];
  params: LeadGenJobParams;
  query: string;
  raw_count: number | null;
  lead_count: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function fetchLeadGenJobs(limit = 50): Promise<LeadGenJobRow[]> {
  const admin = getServerSupabase();

  const { data: jobs, error } = await admin
    .from("lead_gen_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`lead_gen_jobs fetch failed: ${error.message}`);

  const rawJobs = (jobs ?? []) as RawJob[];
  const userIds = [...new Set(rawJobs.map((job) => job.user_id))];

  const emailByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    if (profilesError) {
      // Emails sind Komfort, kein Muss — Tabelle bleibt nutzbar.
      console.error("[admin/lists] profiles fetch failed", profilesError);
    }
    for (const profile of profiles ?? []) {
      emailByUser.set(profile.id, profile.email);
    }
  }

  return rawJobs.map((job) => ({
    id: job.id,
    status: job.status,
    params: job.params ?? {},
    query: job.query,
    raw_count: job.raw_count,
    lead_count: job.lead_count,
    error: job.error,
    created_at: job.created_at,
    completed_at: job.completed_at,
    user_email: emailByUser.get(job.user_id) ?? null,
  }));
}

export async function fetchLeadGenStats(days = 30): Promise<LeadGenStats> {
  const admin = getServerSupabase();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("lead_gen_jobs")
    .select("status, raw_count, lead_count")
    .gte("created_at", since);
  if (error) throw new Error(`lead_gen_jobs stats failed: ${error.message}`);

  const stats: LeadGenStats = {
    total: 0,
    ready: 0,
    failed: 0,
    pending: 0,
    rawRecords: 0,
    deliveredLeads: 0,
    estimatedSpendUsd: 0,
  };
  for (const job of data ?? []) {
    stats.total += 1;
    if (job.status === "ready") stats.ready += 1;
    else if (job.status === "failed") stats.failed += 1;
    else stats.pending += 1;
    stats.rawRecords += job.raw_count ?? 0;
    stats.deliveredLeads += job.lead_count ?? 0;
  }
  stats.estimatedSpendUsd =
    Math.round((stats.rawRecords / 1000) * 3 * 100) / 100;
  return stats;
}
