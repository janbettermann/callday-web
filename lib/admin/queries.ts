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
// Activation Funnel
// ----------------------------------------------------------------

export type FunnelMetrics = {
  applications: number;
  signups: number;
  withList: number;
  withFirstCall: number;
  activeLast7Days: number;
};

export async function fetchFunnel(): Promise<FunnelMetrics> {
  const sb = getServerSupabase();
  const since7d = daysAgo(7);

  const [
    applications,
    signups,
    usersWithList,
    usersWithCall,
    activeUsers,
  ] = await Promise.all([
    sb.from("applications").select("id", { count: "exact", head: true }),
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb
      .from("lead_lists")
      .select("user_id", { count: "exact", head: false })
      .then((r) => ({
        count: new Set((r.data ?? []).map((row) => row.user_id)).size,
      })),
    sb
      .from("call_outcomes")
      .select("user_id", { count: "exact", head: false })
      .then((r) => ({
        count: new Set((r.data ?? []).map((row) => row.user_id)).size,
      })),
    sb
      .from("call_outcomes")
      .select("user_id, called_at")
      .gte("called_at", since7d)
      .then((r) => ({
        count: new Set((r.data ?? []).map((row) => row.user_id)).size,
      })),
  ]);

  return {
    applications: applications.count ?? 0,
    signups: signups.count ?? 0,
    withList: usersWithList.count,
    withFirstCall: usersWithCall.count,
    activeLast7Days: activeUsers.count,
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

export async function fetchDailyCallers(): Promise<DailyCallerPoint[]> {
  const sb = getServerSupabase();
  const since = daysAgo(30);

  const { data } = await sb
    .from("call_outcomes")
    .select("user_id, called_at")
    .gte("called_at", since);

  // Bucket pro UTC-Tag. Wir nehmen UTC bewusst — der Dashboard-User
  // sitzt in Europa, aber 1 Tag Drift macht hier optisch nichts kaputt
  // und spart eine TZ-Lib.
  const byDay = new Map<string, { callers: Set<string>; calls: number }>();
  for (const row of data ?? []) {
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
// Outcome Mix (letzte 7 Tage, stacked-bar pro Tag)
// ----------------------------------------------------------------

export type OutcomeMixPoint = {
  date: string;
  meeting: number;
  callback: number;
  not_reached: number;
  no_interest: number;
  blocked: number;
  other: number;
};

const OUTCOME_KEYS = [
  "meeting",
  "callback",
  "not_reached",
  "no_interest",
  "blocked",
] as const;

export async function fetchOutcomeMix(): Promise<OutcomeMixPoint[]> {
  const sb = getServerSupabase();
  const since = daysAgo(7);

  const { data } = await sb
    .from("call_outcomes")
    .select("outcome, called_at")
    .gte("called_at", since);

  const byDay = new Map<string, OutcomeMixPoint>();
  function ensure(d: string): OutcomeMixPoint {
    let p = byDay.get(d);
    if (!p) {
      p = {
        date: d,
        meeting: 0,
        callback: 0,
        not_reached: 0,
        no_interest: 0,
        blocked: 0,
        other: 0,
      };
      byDay.set(d, p);
    }
    return p;
  }

  for (const row of data ?? []) {
    const d = dateKey(new Date(row.called_at));
    const p = ensure(d);
    const k = row.outcome as (typeof OUTCOME_KEYS)[number];
    if ((OUTCOME_KEYS as readonly string[]).includes(k)) {
      (p as unknown as Record<string, number>)[k] += 1;
    } else {
      p.other += 1;
    }
  }

  const out: OutcomeMixPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = dateKey(new Date(Date.now() - i * ONE_DAY));
    out.push(ensure(d));
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

export async function fetchTopUsers(limit = 20): Promise<TopUserRow[]> {
  const sb = getServerSupabase();

  // 1) Alle Profiles ziehen — bei <200 Beta-Usern unkritisch
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, email, name, created_at")
    .order("created_at", { ascending: false });

  if (!profiles || profiles.length === 0) return [];

  // 2) Outcomes der letzten 90 Tage ziehen — fuer "most_common_outcome"
  //    und "last_called_at" reicht das. Bei langer Beta-Phase ggf. cap
  //    raufziehen.
  const { data: outcomes } = await sb
    .from("call_outcomes")
    .select("user_id, outcome, called_at")
    .gte("called_at", daysAgo(90))
    .order("called_at", { ascending: false });

  // 3) Listen pro User
  const { data: lists } = await sb.from("lead_lists").select("user_id");

  const callsByUser = new Map<string, number>();
  const lastByUser = new Map<string, string>();
  const outcomeFreq = new Map<string, Map<string, number>>();
  for (const row of outcomes ?? []) {
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
  for (const row of lists ?? []) {
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

export async function fetchInactiveUsers(limit = 30): Promise<InactiveUserRow[]> {
  const sb = getServerSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * ONE_DAY);

  const { data: profiles } = await sb
    .from("profiles")
    .select("id, email, name, created_at")
    .order("created_at", { ascending: false });

  if (!profiles) return [];

  const { data: outcomes } = await sb
    .from("call_outcomes")
    .select("user_id, called_at")
    .order("called_at", { ascending: false });

  const callsByUser = new Map<string, number>();
  const lastByUser = new Map<string, string>();
  for (const row of outcomes ?? []) {
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

export async function fetchLatestFeedback(limit = 20): Promise<FeedbackRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("beta_feedback")
    .select("id, email, rating, text, app_version, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Tabelle existiert evtl. noch nicht (Migration nicht deployed) —
    // leerer State statt 500.
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data as FeedbackRow[]) ?? [];
}
