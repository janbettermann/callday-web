import "server-only";

import { getServerSupabase } from "../supabase-server";

/**
 * Admin-Affiliate-Queries — service_role, server-only.
 *
 * Sign-up-Count: count(profiles.id) where referred_by_affiliate_id =
 * affiliate.id. Wir joinen das im SELECT statt eine View zu pflegen —
 * bei 20-30 Affiliates ist die Performance vernachlaessigbar.
 *
 * Activated-Count: distinct profiles mit mindestens einer lead_list.
 * Per Plan-Decision = "list uploaded".
 *
 * Lifecycle-Types + deriveLifecycle leben in ./affiliate-lifecycle.ts
 * damit Client-Components sie importieren koennen — diese Datei hier
 * ist server-only wegen der DB-Calls.
 */

export type {
  AffiliateStatus,
  AffiliateLifecycle,
} from "./affiliate-lifecycle";
export { deriveLifecycle } from "./affiliate-lifecycle";
import type { AffiliateStatus } from "./affiliate-lifecycle";

export interface AffiliateRow {
  id: string;
  slug: string;
  name: string;
  email: string;
  status: AffiliateStatus;
  founder_tier: boolean;
  notes: string | null;
  invited_at: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  created_at: string;
  signup_count: number;
  activated_count: number;
}

interface RawAffiliate {
  id: string;
  slug: string;
  name: string;
  email: string;
  status: AffiliateStatus;
  founder_tier: boolean;
  notes: string | null;
  invited_at: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

/**
 * Liste aller Affiliates, sortiert nach created_at desc. Sign-up- und
 * Activated-Counts werden ueber separate count-queries beigesteuert
 * (Supabase-Postgrest unterstuetzt count via separates head-Query).
 *
 * Bewusst NICHT als single big-join — Supabase-Postgrest macht dabei
 * gerne unsinnige planner-Entscheidungen und der Overhead von 2 extra
 * Queries pro Affiliate bei <50 Eintraegen ist trivial.
 */
export async function fetchAffiliates(): Promise<AffiliateRow[]> {
  const sb = getServerSupabase();

  const { data, error } = await sb
    .from("affiliates")
    .select(
      "id, slug, name, email, status, founder_tier, notes, invited_at, first_login_at, last_login_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const affiliates = (data ?? []) as RawAffiliate[];
  if (affiliates.length === 0) return [];

  // Sign-up-Counts pro Affiliate-ID parallel laden.
  const ids = affiliates.map((a) => a.id);
  const signupCounts = await fetchSignupCounts(ids);
  const activatedCounts = await fetchActivatedCounts(ids);

  return affiliates.map((a) => ({
    ...a,
    signup_count: signupCounts.get(a.id) ?? 0,
    activated_count: activatedCounts.get(a.id) ?? 0,
  }));
}

export async function fetchAffiliateById(
  id: string,
): Promise<AffiliateRow | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("affiliates")
    .select(
      "id, slug, name, email, status, founder_tier, notes, invited_at, first_login_at, last_login_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const raw = data as RawAffiliate;
  const [signupCounts, activatedCounts] = await Promise.all([
    fetchSignupCounts([id]),
    fetchActivatedCounts([id]),
  ]);

  return {
    ...raw,
    signup_count: signupCounts.get(id) ?? 0,
    activated_count: activatedCounts.get(id) ?? 0,
  };
}

/**
 * Map<affiliate_id, count> ueber profiles.referred_by_affiliate_id.
 * Nutzt einen single SELECT mit Client-side-grouping — Postgrest hat
 * keine native group_by-API. Bei 20-30 Affiliates und <500 referred
 * Profilen ist das instant.
 */
async function fetchSignupCounts(
  affiliateIds: string[],
): Promise<Map<string, number>> {
  if (affiliateIds.length === 0) return new Map();
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("referred_by_affiliate_id")
    .in("referred_by_affiliate_id", affiliateIds);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { referred_by_affiliate_id: string | null })
      .referred_by_affiliate_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Activated = User hat >=1 lead_list importiert (Plan-Decision).
 * Per Affiliate zaehlen wir distinct user_ids mit Lead-List, deren
 * Profil ueber referred_by_affiliate_id auf den Affiliate zeigt.
 */
async function fetchActivatedCounts(
  affiliateIds: string[],
): Promise<Map<string, number>> {
  if (affiliateIds.length === 0) return new Map();
  const sb = getServerSupabase();

  // Erst die referrierten Profile holen (id + affiliate_id), dann gegen
  // distinct user_ids in lead_lists matchen. Zwei einfache Queries
  // beats Postgrest-Inner-Join-Komplexitaet.
  const { data: profiles, error: profilesErr } = await sb
    .from("profiles")
    .select("id, referred_by_affiliate_id")
    .in("referred_by_affiliate_id", affiliateIds);
  if (profilesErr) throw profilesErr;

  const profileToAffiliate = new Map<string, string>();
  const profileIds: string[] = [];
  for (const row of profiles ?? []) {
    const r = row as { id: string; referred_by_affiliate_id: string };
    profileToAffiliate.set(r.id, r.referred_by_affiliate_id);
    profileIds.push(r.id);
  }

  if (profileIds.length === 0) return new Map();

  // Distinct user_ids mit mindestens einer Liste.
  const { data: lists, error: listsErr } = await sb
    .from("lead_lists")
    .select("user_id")
    .in("user_id", profileIds);
  if (listsErr) throw listsErr;

  const activatedUserIds = new Set<string>();
  for (const row of lists ?? []) {
    activatedUserIds.add((row as { user_id: string }).user_id);
  }

  const counts = new Map<string, number>();
  for (const userId of activatedUserIds) {
    const affiliateId = profileToAffiliate.get(userId);
    if (!affiliateId) continue;
    counts.set(affiliateId, (counts.get(affiliateId) ?? 0) + 1);
  }
  return counts;
}
