import { getServerSupabase } from "./supabase-server";

export interface ActivityEvent {
  type: "view" | "signup";
  created_at: string;
  referrer_host?: string | null;
}

export interface AffiliateActivity {
  allViews: Array<{
    created_at: string;
    referrer_host: string | null;
    visitor_hash: string;
  }>;
  allSignups: Array<{ created_at: string }>;
  uniqueVisitors: number;
  signupCount: number;
  signupRate: string;
  /** Dedupliziert + absteigend sortiert. Caller slict nach Bedarf (Dashboard: 10). */
  activity: ActivityEvent[];
}

/**
 * ALLE Views + Sign-ups eines Affiliates plus die abgeleiteten Stats und der
 * (deduplizierte, sortierte) Activity-Feed. Eine Quelle fuer /affiliate/dashboard
 * UND /affiliate/activity — kein Copy-Paste der Fetch-/Dedupe-Logik.
 *
 * Volumen ist klein (~100 Views/Monat), daher unbounded. Falls das mal
 * hoch geht: SQL-side DISTINCT ON via RPC.
 */
export async function getAffiliateActivity(
  affiliateId: string,
): Promise<AffiliateActivity> {
  const sb = getServerSupabase();
  const [viewsRes, signupsRes] = await Promise.all([
    sb
      .from("affiliate_page_views")
      .select("created_at, referrer_host, visitor_hash")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: true }),
    sb
      .from("profiles")
      .select("created_at")
      .eq("referred_by_affiliate_id", affiliateId)
      .order("created_at", { ascending: false }),
  ]);

  const allViews = (viewsRes.data ?? []) as AffiliateActivity["allViews"];
  const allSignups = (signupsRes.data ?? []) as AffiliateActivity["allSignups"];

  const uniqueVisitors = new Set(allViews.map((v) => v.visitor_hash)).size;
  const signupCount = allSignups.length;
  const signupRate =
    uniqueVisitors === 0
      ? "—"
      : `${Math.round((signupCount / uniqueVisitors) * 100)}%`;

  // Visitor-Dedupe: pro visitor_hash nur den ersten (aeltesten) Eintrag.
  // allViews lief ASC → erstes Vorkommen ist der aelteste. visitor_hash
  // rotiert taeglich (daily-salt) → derselbe Mensch am naechsten Tag = neuer
  // Hash = neuer Visitor. Innerhalb eines Tages: nur erster Visit.
  const firstVisitByHash = new Map<
    string,
    { created_at: string; referrer_host: string | null }
  >();
  for (const v of allViews) {
    if (!firstVisitByHash.has(v.visitor_hash)) {
      firstVisitByHash.set(v.visitor_hash, {
        created_at: v.created_at,
        referrer_host: v.referrer_host,
      });
    }
  }

  const visitorEvents: ActivityEvent[] = Array.from(
    firstVisitByHash.values(),
  ).map((v) => ({
    type: "view",
    created_at: v.created_at,
    referrer_host: v.referrer_host,
  }));
  const signupEvents: ActivityEvent[] = allSignups.map((s) => ({
    type: "signup",
    created_at: s.created_at,
  }));

  const activity = [...visitorEvents, ...signupEvents].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return {
    allViews,
    allSignups,
    uniqueVisitors,
    signupCount,
    signupRate,
    activity,
  };
}

export interface PostRow {
  id: string;
  url: string;
  platform: string | null;
  posted_at: string;
  note: string | null;
}

export interface PostStat {
  post: PostRow;
  visitors: number;
  signups: number;
}

// Zeitfenster fuer die Post→Views/Sign-ups-Korrelation.
export const POST_WINDOW_HOURS = 48;

/**
 * Pro Post: Unique-Visitors + Sign-ups im Fenster [posted_at, +windowHours].
 * Fenster koennen sich ueberlappen (nah beieinander liegende Posts) — bewusst
 * so (zeitliche Korrelation, keine harte Zuordnung). Pure Funktion, damit
 * Dashboard (nutzt die vorhandenen allViews/allSignups) und /affiliate/posts
 * sie teilen — kein Doppel-Fetch, kein Copy-Paste.
 */
export function computePostStats(
  posts: PostRow[],
  allViews: AffiliateActivity["allViews"],
  allSignups: AffiliateActivity["allSignups"],
  windowHours: number = POST_WINDOW_HOURS,
): PostStat[] {
  const windowMs = windowHours * 60 * 60 * 1000;
  return posts.map((post) => {
    const start = new Date(post.posted_at).getTime();
    const end = start + windowMs;
    const hashes = new Set<string>();
    for (const v of allViews) {
      const t = new Date(v.created_at).getTime();
      if (t >= start && t <= end) hashes.add(v.visitor_hash);
    }
    let signups = 0;
    for (const s of allSignups) {
      const t = new Date(s.created_at).getTime();
      if (t >= start && t <= end) signups += 1;
    }
    return { post, visitors: hashes.size, signups };
  });
}

/** Relative-Zeit-Formatter (TZ-agnostisch — nur Dauer). */
export function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}
