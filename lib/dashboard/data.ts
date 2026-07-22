/**
 * Datenschicht des Account-Dashboards (callday.io/dashboard).
 *
 * Liest die gesyncte App-Aktivitaet server-seitig: die letzten Listen
 * mit Fortschritt (lead_lists + leads) und die letzten "Calldays" —
 * Tage, an denen der User telefoniert hat (Aggregation aus
 * call_outcomes). Beide bewusst knapp (Listen: 2, Calldays: 3): das
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
  /** Relatives Erstell-Datum ("2 days ago") — fuer quellenabhaengige Sub. */
  createdAtRelative: string;
}

interface LeadListRow {
  id: string;
  name: string;
  total_leads: number | null;
  created_at: string;
  last_worked_at: string | null;
}

const LIST_SELECT = "id, name, total_leads, created_at, last_worked_at";

export interface DashboardCallday {
  isoDate: string;
  /** "Jul 14" */
  label: string;
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

/**
 * Rechnet den Fortschritt (total_done) fuer bereits geladene Listen-Rows:
 * eine Leads-Query fuer alle Listen in einem Zug, dann in JS zaehlen —
 * spart eine PostgREST-not.in-Query mit Quoting-Fallen. Geteilt von
 * fetchRecentLists (Dashboard, max 2) und fetchAllLists (/lists, alle).
 */
async function listsWithProgress(
  admin: SupabaseClient,
  userId: string,
  rows: LeadListRow[],
): Promise<DashboardList[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: leadRows, error } = await admin
    .from("leads")
    .select("list_id, status, archived_at")
    .eq("user_id", userId)
    .in("list_id", ids);
  if (error) throw new Error(`lead counts failed: ${error.message}`);

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
    const totalLeads = row.total_leads ?? 0;
    const totalDone = doneByList.get(row.id) ?? 0;
    const worked =
      row.last_worked_at != null && row.last_worked_at !== row.created_at;
    const metaLine =
      !worked && totalDone === 0
        ? `Imported ${relativeShort(row.created_at)}`
        : `Last worked ${relativeShort(row.last_worked_at)}`;
    return {
      id: row.id,
      name: row.name,
      totalLeads,
      totalDone,
      isComplete: totalLeads > 0 && totalDone >= totalLeads,
      worked,
      metaLine,
      createdAtRelative: relativeShort(row.created_at),
    };
  });
}

// Demo-/Sample-Liste bleibt ueberall aussen vor (Jan-Entscheidung
// 2026-07-16): Dashboard + /lists zeigen nur echte + generierte Listen.
function listQuery(admin: SupabaseClient, userId: string) {
  return admin
    .from("lead_lists")
    .select(LIST_SELECT)
    .eq("user_id", userId)
    .eq("is_sample", false)
    .neq("status", "archived")
    .order("last_worked_at", { ascending: false });
}

/** Die letzten `limit` Listen mit Fortschritt — Dashboard-Preview. */
export async function fetchRecentLists(
  admin: SupabaseClient,
  userId: string,
  limit = 2,
): Promise<DashboardList[]> {
  const { data, error } = await listQuery(admin, userId).limit(limit);
  if (error) throw new Error(`recent lists failed: ${error.message}`);
  return listsWithProgress(admin, userId, (data ?? []) as LeadListRow[]);
}

/** Alle Listen mit Fortschritt — /lists-Uebersicht. */
export async function fetchAllLists(
  admin: SupabaseClient,
  userId: string,
): Promise<DashboardList[]> {
  const { data, error } = await listQuery(admin, userId);
  if (error) throw new Error(`all lists failed: ${error.message}`);
  return listsWithProgress(admin, userId, (data ?? []) as LeadListRow[]);
}

/**
 * Alle Calldays des Users, nach Datum absteigend (neueste zuerst).
 * Cap auf die 2000 juengsten Outcomes: nach called_at DESC sortiert,
 * decken sie die angezeigten Tage immer ab. called_at ist NOT NULL,
 * daher kein Null-Filter noetig.
 */
async function bucketCalldays(
  admin: SupabaseClient,
  userId: string,
): Promise<DashboardCallday[]> {
  const { data, error } = await admin
    .from("call_outcomes")
    .select("called_at, outcome")
    .eq("user_id", userId)
    .order("called_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`calldays failed: ${error.message}`);

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
    .map(([isoDate, v]) => ({
      isoDate,
      label: dayMonthLabel(isoDate),
      calls: v.calls,
      meetings: v.meetings,
    }));
}

/** Die letzten `limit` Calldays — Preview auf dem Dashboard. */
export async function fetchRecentCalldays(
  admin: SupabaseClient,
  userId: string,
  limit = 3,
): Promise<DashboardCallday[]> {
  return (await bucketCalldays(admin, userId)).slice(0, limit);
}

/** Volle Callday-Historie — /calldays. */
export async function fetchAllCalldays(
  admin: SupabaseClient,
  userId: string,
): Promise<DashboardCallday[]> {
  return bucketCalldays(admin, userId);
}

/** Erst-Buchstabe fuers Avatar (Name > Email > "?"). */
export function avatarInitial(
  name?: string | null,
  email?: string | null,
): string {
  const source = name?.trim() || email?.trim() || "";
  return source ? source[0].toUpperCase() : "?";
}

export interface ProfileIdentity {
  name: string | null;
  email: string | null;
  /** Vorname (echter Name > null) fuer Begruessungen. */
  firstName: string | null;
  initial: string;
}

/**
 * Profil-Identitaet fuers Nav-Avatar + Begruessung — name/email aus
 * profiles, Auth-Email als Fallback. Zentral, damit jede eingeloggte
 * Seite denselben Avatar-Buchstaben zeigt (nicht mal name-, mal
 * email-basiert). service_role, auf id gescoped.
 */
export async function fetchProfileIdentity(
  admin: SupabaseClient,
  userId: string,
  fallbackEmail: string | null,
): Promise<ProfileIdentity> {
  const { data } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .maybeSingle();
  const name = (data?.name as string | null) ?? null;
  const email = (data?.email as string | null) ?? fallbackEmail ?? null;
  const firstName = name?.trim().split(/\s+/)[0] || null;
  return { name, email, firstName, initial: avatarInitial(name, email) };
}
