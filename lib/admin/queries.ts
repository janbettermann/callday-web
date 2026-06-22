import "server-only";

import { getServerSupabase } from "../supabase-server";

/**
 * Alle Dashboard-Queries gebuendelt. Laeuft AUSSCHLIESSLICH server-side
 * mit service_role — `import "server-only"` blockt versehentliche
 * Client-Imports zur Build-Zeit.
 *
 * Alle Funktionen geben bereits serialisierbare Plain-Objects zurueck,
 * damit sie aus Server-Components problemlos an Client-Charts
 * uebergeben werden koennen.
 */

const ONE_DAY = 86_400_000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * ONE_DAY).toISOString();
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------
// Internal-vs-Real-Filter
//
// Jeder Eintrag hier ist eine RegExp die gegen die volle Email
// gematched wird. Bei Match gilt der Account als "internal" (Jans
// eigene Tests, Reviewer, Sample-Tester). Default-View im Dashboard
// blendet diese aus.
//
// Wenn ein neuer Test-Account auftaucht: hier einen Pattern dazu,
// commit + push. Kein DB-Change noetig.
// ----------------------------------------------------------------

const INTERNAL_PATTERNS: RegExp[] = [
  /^jan\.bettermann/i,        // alle jan.bettermann*@... (Haupt + alle Plus-Tags)
  /^tester@callday\./i,       // tester@callday.io / .ion / .ioj
  /@dealswipe\.app$/i,        // appreview@dealswipe.app + sonstige interne dealswipe.app
  /^screwdriver6000/i,        // screwdriver6000+9@gmail.com
  /^1@mail\.de$/i,            // alter Test-Account
];

export type InternalView = "real" | "internal" | "all";

export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return INTERNAL_PATTERNS.some((p) => p.test(email));
}

function matchesView(
  email: string | null | undefined,
  view: InternalView,
): boolean {
  if (view === "all") return true;
  const internal = isInternalEmail(email);
  return view === "internal" ? internal : !internal;
}

/**
 * Holt die Profile passend zum View. Returnt sowohl die rohe Liste
 * (fuer Top/Inactive-Tabellen) als auch ein Set der user_ids
 * (zum Joinen gegen call_outcomes / lead_lists).
 */
async function getProfilesForView(view: InternalView) {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, name, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const all = data ?? [];
  const filtered = all.filter((p) => matchesView(p.email, view));
  return {
    profiles: filtered,
    userIds: new Set(filtered.map((p) => p.id)),
  };
}

// ----------------------------------------------------------------
// Activation Funnel
// ----------------------------------------------------------------

export type FunnelMetrics = {
  applications: number;
  signups: number;
  withList: number;
  withFirstCall: number;
  activeLast7Days: number;
};

export async function fetchFunnel(view: InternalView): Promise<FunnelMetrics> {
  const sb = getServerSupabase();
  const since7d = daysAgo(7);

  const [
    { profiles, userIds },
    appsRes,
    listsRes,
    outcomesRes,
    recentOutcomesRes,
  ] = await Promise.all([
    getProfilesForView(view),
    sb.from("applications").select("email"),
    sb.from("lead_lists").select("user_id"),
    sb.from("call_outcomes").select("user_id"),
    sb.from("call_outcomes").select("user_id").gte("called_at", since7d),
  ]);

  // Applications filtern per email-pattern (kein user_id-Join möglich,
  // applications kommen vor dem signup)
  const apps = (appsRes.data ?? []).filter((r) =>
    matchesView(r.email, view),
  );

  // user_id-basierte counts auf die View einschränken
  const usersWithList = new Set(
    (listsRes.data ?? [])
      .map((r) => r.user_id)
      .filter((id) => userIds.has(id)),
  );
  const usersWithCall = new Set(
    (outcomesRes.data ?? [])
      .map((r) => r.user_id)
      .filter((id) => userIds.has(id)),
  );
  const activeUsers = new Set(
    (recentOutcomesRes.data ?? [])
      .map((r) => r.user_id)
      .filter((id) => userIds.has(id)),
  );

  return {
    applications: apps.length,
    signups: profiles.length,
    withList: usersWithList.size,
    withFirstCall: usersWithCall.size,
    activeLast7Days: activeUsers.size,
  };
}

// ----------------------------------------------------------------
// Daily Active Callers (letzte 30 Tage)
// ----------------------------------------------------------------

export type DailyCallerPoint = {
  date: string; // YYYY-MM-DD
  callers: number;
  calls: number;
};

export async function fetchDailyCallers(
  view: InternalView,
): Promise<DailyCallerPoint[]> {
  const sb = getServerSupabase();
  const since = daysAgo(30);

  const [{ userIds }, outcomesRes] = await Promise.all([
    getProfilesForView(view),
    sb
      .from("call_outcomes")
      .select("user_id, called_at")
      .gte("called_at", since),
  ]);

  // Bucket pro UTC-Tag. Wir nehmen UTC bewusst — der Dashboard-User
  // sitzt in Europa, aber 1 Tag Drift macht hier optisch nichts kaputt
  // und spart eine TZ-Lib.
  const byDay = new Map<string, { callers: Set<string>; calls: number }>();
  for (const row of outcomesRes.data ?? []) {
    if (view !== "all" && !userIds.has(row.user_id)) continue;
    const d = dateKey(new Date(row.called_at));
    let bucket = byDay.get(d);
    if (!bucket) {
      bucket = { callers: new Set(), calls: 0 };
      byDay.set(d, bucket);
    }
    bucket.callers.add(row.user_id);
    bucket.calls += 1;
  }

  // Fuelle Luecken: jeder der letzten 30 Tage muss einen Punkt haben,
  // sonst rutschen die Recharts-Linien zusammen.
  const out: DailyCallerPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = dateKey(new Date(Date.now() - i * ONE_DAY));
    const b = byDay.get(d);
    out.push({
      date: d,
      callers: b ? b.callers.size : 0,
      calls: b ? b.calls : 0,
    });
  }
  return out;
}

// ----------------------------------------------------------------
// Top Users
// ----------------------------------------------------------------

export type TopUserRow = {
  user_id: string;
  email: string | null;
  name: string;
  created_at: string;
  lists: number;
  calls: number;
  last_called_at: string | null;
  most_common_outcome: string | null;
};

export async function fetchTopUsers(
  view: InternalView,
  limit = 20,
): Promise<TopUserRow[]> {
  const sb = getServerSupabase();

  const [{ profiles }, outcomesRes, listsRes] = await Promise.all([
    getProfilesForView(view),
    sb
      .from("call_outcomes")
      .select("user_id, outcome, called_at")
      .gte("called_at", daysAgo(90))
      .order("called_at", { ascending: false }),
    sb.from("lead_lists").select("user_id"),
  ]);

  if (profiles.length === 0) return [];

  const callsByUser = new Map<string, number>();
  const lastByUser = new Map<string, string>();
  const outcomeFreq = new Map<string, Map<string, number>>();
  for (const row of outcomesRes.data ?? []) {
    callsByUser.set(row.user_id, (callsByUser.get(row.user_id) ?? 0) + 1);
    if (!lastByUser.has(row.user_id)) {
      lastByUser.set(row.user_id, row.called_at);
    }
    let freq = outcomeFreq.get(row.user_id);
    if (!freq) {
      freq = new Map();
      outcomeFreq.set(row.user_id, freq);
    }
    freq.set(row.outcome, (freq.get(row.outcome) ?? 0) + 1);
  }

  const listsByUser = new Map<string, number>();
  for (const row of listsRes.data ?? []) {
    listsByUser.set(row.user_id, (listsByUser.get(row.user_id) ?? 0) + 1);
  }

  function mostCommon(freq: Map<string, number> | undefined): string | null {
    if (!freq || freq.size === 0) return null;
    let best: string | null = null;
    let bestCount = -1;
    for (const [k, v] of freq) {
      if (v > bestCount) {
        best = k;
        bestCount = v;
      }
    }
    return best;
  }

  const rows: TopUserRow[] = profiles.map((p) => ({
    user_id: p.id,
    email: p.email ?? null,
    name: p.name ?? "",
    created_at: p.created_at,
    lists: listsByUser.get(p.id) ?? 0,
    calls: callsByUser.get(p.id) ?? 0,
    last_called_at: lastByUser.get(p.id) ?? null,
    most_common_outcome: mostCommon(outcomeFreq.get(p.id)),
  }));

  rows.sort((a, b) => b.calls - a.calls);
  return rows.slice(0, limit);
}

// ----------------------------------------------------------------
// Inactive Users — angemeldet aber 0 Calls oder 7+ Tage nicht gerufen
// ----------------------------------------------------------------

export type InactiveUserRow = {
  user_id: string;
  email: string | null;
  name: string;
  created_at: string;
  calls: number;
  last_called_at: string | null;
  reason: "never_called" | "stalled";
};

export async function fetchInactiveUsers(
  view: InternalView,
  limit = 30,
): Promise<InactiveUserRow[]> {
  const sb = getServerSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * ONE_DAY);

  const [{ profiles }, outcomesRes] = await Promise.all([
    getProfilesForView(view),
    sb
      .from("call_outcomes")
      .select("user_id, called_at")
      .order("called_at", { ascending: false }),
  ]);

  const callsByUser = new Map<string, number>();
  const lastByUser = new Map<string, string>();
  for (const row of outcomesRes.data ?? []) {
    callsByUser.set(row.user_id, (callsByUser.get(row.user_id) ?? 0) + 1);
    if (!lastByUser.has(row.user_id)) {
      lastByUser.set(row.user_id, row.called_at);
    }
  }

  const rows: InactiveUserRow[] = [];
  for (const p of profiles) {
    const calls = callsByUser.get(p.id) ?? 0;
    const last = lastByUser.get(p.id) ?? null;

    if (calls === 0) {
      rows.push({
        user_id: p.id,
        email: p.email ?? null,
        name: p.name ?? "",
        created_at: p.created_at,
        calls: 0,
        last_called_at: null,
        reason: "never_called",
      });
    } else if (last && new Date(last) < sevenDaysAgo) {
      rows.push({
        user_id: p.id,
        email: p.email ?? null,
        name: p.name ?? "",
        created_at: p.created_at,
        calls,
        last_called_at: last,
        reason: "stalled",
      });
    }
  }

  // Sort: never_called nach Signup desc, dann stalled nach last_called asc
  rows.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "never_called" ? -1 : 1;
    if (a.reason === "never_called") {
      return b.created_at.localeCompare(a.created_at);
    }
    return (a.last_called_at ?? "").localeCompare(b.last_called_at ?? "");
  });

  return rows.slice(0, limit);
}

// ----------------------------------------------------------------
// Feedback
// ----------------------------------------------------------------

export type FeedbackRow = {
  id: string;
  email: string | null;
  rating: number;
  text: string | null;
  app_version: string | null;
  created_at: string;
};

export async function fetchLatestFeedback(
  view: InternalView,
  limit = 20,
): Promise<FeedbackRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("beta_feedback")
    .select("id, email, rating, text, app_version, created_at")
    .order("created_at", { ascending: false })
    .limit(limit * 3); // ueberholen, dann clientseitig filtern

  if (error) {
    // Tabelle existiert evtl. noch nicht (Migration nicht deployed) —
    // leerer State statt 500.
    if (error.code === "42P01") return [];
    throw error;
  }
  const rows = (data as FeedbackRow[]) ?? [];
  return rows.filter((r) => matchesView(r.email, view)).slice(0, limit);
}
