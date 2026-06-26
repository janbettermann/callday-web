/**
 * Affiliate-Lifecycle-Types + pure Helper. Bewusst OHNE "server-only"
 * Marker damit Client-Components (AffiliateTable, AffiliateDetailDrawer)
 * den deriveLifecycle-Helper importieren koennen.
 *
 * Die DB-Queries leben weiter in affiliate-queries.ts mit server-only.
 */

export type AffiliateStatus = "active" | "paused" | "removed";

export type AffiliateLifecycle =
  | "created" // status=active, !invited_at
  | "invited" // status=active, invited_at, !first_login_at
  | "active_logged_in" // status=active, first_login_at
  | "paused"
  | "removed";

export function deriveLifecycle(input: {
  status: AffiliateStatus;
  invited_at: string | null;
  first_login_at: string | null;
}): AffiliateLifecycle {
  if (input.status === "paused") return "paused";
  if (input.status === "removed") return "removed";
  if (input.first_login_at) return "active_logged_in";
  if (input.invited_at) return "invited";
  return "created";
}
