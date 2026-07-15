/**
 * Datenschicht des Account-Dashboards (callday.io/dashboard).
 *
 * Liest die gesyncte App-Aktivitaet server-seitig: die letzten Listen
 * mit Fortschritt (lead_lists + leads) und die letzten "Calldays" —
 * Tage, an denen der User telefoniert hat (Aggregation aus
 * call_outcomes). Beide bewusst auf die letzten zwei begrenzt: das
 * Dashboard zeigt "recent", die Vollansicht haengt hinter den
 * "All your …"-Links.
 *
 * Client: getServerSupabase() (service_role), IMMER auf user_id
 * gescoped — gleiche Pattern wie fetchJobsForUser / LeadListsSection.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardList {
  id: string;
  name: string;
  totalLeads: number;
  totalDone: number;
  isComplete: boolean;
  /** ACTIVE-Badge-Kandidat: die Liste wurde tatsaechlich schon bearbeitet. */
  worked: boolean;
  metaLine: string;
}

export interface DashboardCallday {
  isoDate: string;
  /** "Jul 14" */
  label: string;
  /** "Today" | "Yesterday" | Wochentag */
  relative: string;
  calls: number;
  meetings: number;
}

// Fortschritts-Definition 1:1 aus der App (utils/queries/lists.ts):
// erledigt = Lead ist archiviert ODER hat einen Status jenseits von
// new/not_reached (not_reached = versucht, aber noch offen).
const NOT_DONE_STATUSES = new Set(["new", "not_reached"]);

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function relativeShort(iso: string | null): string {
  if (!iso) return "recently";
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 90) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1mo ago" : `${months}mo ago`;
}

/**
 * Tages-Bucketing der Calls. Achtung: gruppiert nach UTC-Kalendertag —
 * ohne gespeicherte User-Zeitzone der pragmatische Stand fuer die Beta
 * (DACH ≈ UTC). Zeitzonen-Verfeinerung ist ein spaeteres TODO.
 */
function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function dayMonthLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  return `${MONTHS[m - 1]} ${d}`;
}

function relativeDayLabel(isoDate: string): string {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (isoDate === todayIso) return "Today";
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (isoDate === yesterday) return "Yesterday";
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export async function fetchRecentLists(
  admin: SupabaseClient,
  userId: string,
  limit = 2,
): Promise<DashboardList[]> {
  const { data: lists, error } = await admin
    .from("lead_lists")
    .select("id, name, total_leads, created_at, last_worked_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("last_worked_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recent lists failed: ${error.message}`);
  const rows = lists ?? [];
  if (rows.length === 0) return [];

  // total_done fuer die (max 2) sichtbaren Listen in einem Zug holen und
  // in JS zaehlen — spart eine PostgREST-not.in-Query mit Quoting-Fallen.
  const ids = rows.map((r) => r.id as string);
  const { data: leadRows, error: leadError } = await admin
    .from("leads")
    .select("list_id, status, archived_at")
    .eq("user_id", userId)
    .in("list_id", ids);
  if (leadError) throw new Error(`lead counts failed: ${leadError.message}`);

  const doneByList = new Map<string, number>();
  for (const lead of leadRows ?? []) {
    const done =
      lead.archived_at != null || !NOT_DONE_STATUSES.has(lead.status as string);
    if (done) {
      const key = lead.list_id as string;
      doneByList.set(key, (doneByList.get(key) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const totalLeads = (row.total_leads as number) ?? 0;
    const totalDone = doneByList.get(row.id as string) ?? 0;
    const worked =
      row.last_worked_at != null && row.last_worked_at !== row.created_at;
    const metaLine =
      !worked && totalDone === 0
        ? `Imported ${relativeShort(row.created_at as string)}`
        : `Last worked ${relativeShort(row.last_worked_at as string)}`;
    return {
      id: row.id as string,
      name: row.name as string,
      totalLeads,
      totalDone,
      isComplete: totalLeads > 0 && totalDone >= totalLeads,
      worked,
      metaLine,
    };
  });
}

export async function fetchRecentCalldays(
  admin: SupabaseClient,
  userId: string,
  limit = 2,
): Promise<DashboardCallday[]> {
  const { data, error } = await admin
    .from("call_outcomes")
    .select("called_at, outcome")
    .eq("user_id", userId)
    .not("called_at", "is", null)
    .order("called_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`recent calldays failed: ${error.message}`);

  const byDay = new Map<string, { calls: number; meetings: number }>();
  for (const row of data ?? []) {
    const iso = utcDay(row.called_at as string);
    const bucket = byDay.get(iso) ?? { calls: 0, meetings: 0 };
    bucket.calls += 1;
    if (row.outcome === "meeting") bucket.meetings += 1;
    byDay.set(iso, bucket);
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limit)
    .map(([isoDate, v]) => ({
      isoDate,
      label: dayMonthLabel(isoDate),
      relative: relativeDayLabel(isoDate),
      calls: v.calls,
      meetings: v.meetings,
    }));
}

/** Erst-Buchstabe fuers Avatar (Name > Email > "?"). */
export function avatarInitial(
  name?: string | null,
  email?: string | null,
): string {
  const source = name?.trim() || email?.trim() || "";
  return source ? source[0].toUpperCase() : "?";
}
