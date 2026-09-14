import "server-only";

import { getServerSupabase } from "../supabase-server";
import {
  buildExperimentReport,
  type ExperimentReport,
  type LpEventRow,
} from "@/lib/lp/aggregate";
import { ACTIVE_EXPERIMENT } from "@/lib/lp/experiments";
import type { LpDevice, LpPage, LpSource } from "@/lib/lp/shared";

/**
 * Queries fuer /[secret]/experiments. Wie lib/admin/queries.ts: service_role,
 * alles server-side, Rueckgaben sind Plain-Objects. Die Aggregation (Uniques
 * pro Metrik, Segmente, Experiment-Report) ist pure Logik in
 * lib/lp/aggregate.ts und dort getestet.
 */

export {
  DEVICE_ORDER,
  byDevice,
  bySource,
  dailySeries,
  totals,
  type DeviceKey,
  type ExperimentReport,
  type FunnelCounts,
  type LpEventRow,
} from "@/lib/lp/aggregate";

const PAGE_SIZE = 1000; // PostgREST max-rows Default bei Supabase
const MAX_PAGES = 50;

/** PostgREST meldet eine fehlende Tabelle als PGRST205, Postgres als 42P01. */
function isTableMissing(code: string | undefined): boolean {
  return code === "PGRST205" || code === "42P01";
}

/**
 * Alle Events einer Seite ab `sinceIso` (null = alles), neueste zuerst.
 * Paginiert in 1000er-Schritten, weil Supabase groessere Antworten still
 * kappt. Fehlt die Tabelle (Migration 0058 noch nicht angewendet), kommt
 * ein leeres Array mit `tableMissing` zurueck und die Seite zeigt den
 * Hinweis.
 */
export async function fetchLpEvents(opts: {
  sinceIso: string | null;
  page: LpPage;
}): Promise<{ rows: LpEventRow[]; tableMissing: boolean }> {
  const sb = getServerSupabase();
  const rows: LpEventRow[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    let q = sb
      .from("lp_events")
      .select(
        "id, created_at, page, event, label, experiment_key, variant, visitor_hash, session_id, user_id, source, utm_campaign, utm_content, device, platform, in_app, country",
      )
      .eq("page", opts.page)
      .order("created_at", { ascending: false })
      .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
    if (opts.sinceIso) q = q.gte("created_at", opts.sinceIso);

    const { data, error } = await q;
    if (error) {
      if (isTableMissing(error.code)) return { rows: [], tableMissing: true };
      throw error;
    }
    const chunk = (data ?? []) as LpEventRow[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }

  return { rows, tableMissing: false };
}

export function activeExperimentReport(rows: LpEventRow[]): ExperimentReport | null {
  return ACTIVE_EXPERIMENT ? buildExperimentReport(rows, ACTIVE_EXPERIMENT) : null;
}

// ----------------------------------------------------------------
// Letzte Sign-ups mit Herkunft
// ----------------------------------------------------------------

export interface RecentSignupRow {
  created_at: string;
  email: string | null;
  source: LpSource;
  experiment_key: string | null;
  variant: string | null;
  device: LpDevice;
  in_app: boolean;
  country: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

export async function recentSignups(
  rows: LpEventRow[],
  limit = 20,
): Promise<RecentSignupRow[]> {
  const confirmed = rows
    .filter((r) => r.event === "signup_confirmed")
    .slice(0, limit);
  if (confirmed.length === 0) return [];

  const ids = Array.from(
    new Set(confirmed.map((r) => r.user_id).filter((id): id is string => !!id)),
  );
  const emails = new Map<string, string | null>();
  if (ids.length > 0) {
    const sb = getServerSupabase();
    const { data } = await sb.from("profiles").select("id, email").in("id", ids);
    for (const p of data ?? []) emails.set(p.id, p.email ?? null);
  }

  return confirmed.map((r) => ({
    created_at: r.created_at,
    email: r.user_id ? (emails.get(r.user_id) ?? null) : null,
    source: r.source,
    experiment_key: r.experiment_key,
    variant: r.variant,
    device: r.device,
    in_app: r.in_app,
    country: r.country,
    utm_campaign: r.utm_campaign,
    utm_content: r.utm_content,
  }));
}
