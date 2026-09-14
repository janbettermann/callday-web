import "server-only";

import { getServerSupabase } from "../supabase-server";
import {
  buildDashboard,
  type CallRow,
  type DashboardData,
  type DashboardOptions,
  type DashboardSource,
  type FeedbackRow,
  type ListRow,
  type ProfileRow,
  type SubscriptionEventRow,
} from "./dashboard-metrics";

/**
 * Loader fuer die Admin-Uebersicht (/[secret]). Laeuft AUSSCHLIESSLICH
 * server-side mit service_role; `import "server-only"` blockt
 * versehentliche Client-Imports zur Build-Zeit.
 *
 * Holt die Roh-Rows in einem Rutsch und ueberlaesst das Rechnen
 * lib/admin/dashboard-metrics.ts (rein, getestet). Alle Tabellen sind
 * heute klein (Profile, Calls, Listen jeweils unter 1.000 Rows); sobald
 * call_outcomes das Supabase-Row-Limit (1.000) reisst, muessen Calls
 * ueber ein Aggregat (RPC) statt als Rohliste kommen.
 */

const PROFILE_COLUMNS =
  "id, email, name, created_at, onboarding_completed, subscription_status, subscription_plan, plan_type";
const FEEDBACK_COLUMNS = "id, email, category, rating, text, app_version, source, created_at";
const SUBSCRIPTION_EVENT_COLUMNS = "id, event_type, app_user_id, product_id, received_at";

export async function loadDashboardSource(): Promise<DashboardSource> {
  const sb = getServerSupabase();

  const [profilesRes, callsRes, listsRes, feedbackRes, eventsRes] = await Promise.all([
    sb.from("profiles").select(PROFILE_COLUMNS).order("created_at", { ascending: false }),
    sb.from("call_outcomes").select("user_id, called_at, outcome"),
    // Beispiel-Listen legt die App fuer jeden neuen Account an; sie
    // sagen nichts ueber Aktivierung und bleiben deshalb draussen.
    sb.from("lead_lists").select("user_id, created_at").eq("is_sample", false),
    sb
      .from("beta_feedback")
      .select(FEEDBACK_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200),
    // Sandbox-Events (TestFlight, Simulator) sind Rauschen; nur echte
    // Store-Kaeufe zaehlen.
    sb
      .from("revenuecat_event_log")
      .select(SUBSCRIPTION_EVENT_COLUMNS)
      .eq("environment", "PRODUCTION")
      .order("received_at", { ascending: false })
      .limit(20),
  ]);

  if (profilesRes.error) throw new Error(`profiles: ${profilesRes.error.message}`);
  if (callsRes.error) throw new Error(`call_outcomes: ${callsRes.error.message}`);
  if (listsRes.error) throw new Error(`lead_lists: ${listsRes.error.message}`);
  if (feedbackRes.error) throw new Error(`beta_feedback: ${feedbackRes.error.message}`);
  if (eventsRes.error) throw new Error(`revenuecat_event_log: ${eventsRes.error.message}`);

  return {
    profiles: (profilesRes.data ?? []) as ProfileRow[],
    calls: (callsRes.data ?? []) as CallRow[],
    lists: (listsRes.data ?? []) as ListRow[],
    feedback: (feedbackRes.data ?? []) as FeedbackRow[],
    subscriptionEvents: (eventsRes.data ?? []) as SubscriptionEventRow[],
  };
}

export async function fetchDashboard(
  opts: Omit<DashboardOptions, "now">,
): Promise<DashboardData> {
  const source = await loadDashboardSource();
  return buildDashboard(source, opts);
}
