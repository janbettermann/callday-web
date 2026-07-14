/**
 * GET /api/lists/status[?job=<id>] — Job-Status fuer die /lists-UI.
 *
 * Ohne job-Param: der neueste Job des eingeloggten Users (damit die
 * Seite nach Reload/Rueckkehr ihren Zustand wiederfindet — bei Cap 1
 * ist der letzte Job praktisch DER Zustand der Seite).
 *
 * Self-Heal: haengt der Job noch auf pending, versucht der Poll die
 * Verarbeitung direkt (processJobIfFinished fragt Outscraper und
 * early-returnt, solange dort nichts fertig ist). Damit funktioniert
 * der Flow auch ohne erreichbaren Webhook — lokale Dev-Umgebung,
 * verlorene Webhook-Zustellung.
 *
 * Response enthaelt bewusst NIE das webhook_secret.
 */

import { NextRequest } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  buildListName,
  fetchLatestJobForUser,
  processJobIfFinished,
  type LeadGenJob,
} from "@/lib/lists/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobParam = request.nextUrl.searchParams.get("job");
  if (jobParam && !UUID_PATTERN.test(jobParam)) {
    return Response.json({ error: "invalid_job" }, { status: 400 });
  }

  const admin = getServerSupabase();

  let job: LeadGenJob | null;
  if (jobParam) {
    const { data, error } = await admin
      .from("lead_gen_jobs")
      .select(
        "id, user_id, status, params, query, webhook_secret, outscraper_request_id, list_id, raw_count, lead_count, error, is_free, ready_email_sent_at, created_at",
      )
      .eq("id", jobParam)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[lists/status] job fetch failed", error);
      return Response.json({ error: "status_failed" }, { status: 500 });
    }
    job = data as LeadGenJob | null;
  } else {
    job = await fetchLatestJobForUser(admin, user.id);
  }

  if (!job) {
    return Response.json({ job: null });
  }

  if (job.status === "pending") {
    try {
      job = await processJobIfFinished(admin, job);
    } catch (err) {
      // Self-Heal-Fehler nicht an den Client durchreichen — der Job
      // bleibt pending und der naechste Poll probiert es wieder.
      console.error("[lists/status] self-heal failed", err);
    }
  }

  return Response.json({
    job: {
      id: job.id,
      status: job.status,
      error: job.error,
      leadCount: job.lead_count,
      listId: job.list_id,
      listName: buildListName(job.params, job.query),
      params: job.params,
      createdAt: job.created_at,
    },
  });
}
