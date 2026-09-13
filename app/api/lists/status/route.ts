/**
 * GET /api/lists/status[?job=<id>] — Job-Status fuer die /lists-UI und
 * die Building-Kachel der Callday-App.
 *
 * Ohne job-Param: der neueste Job des eingeloggten Users (damit die
 * Seite nach Reload/Rueckkehr ihren Zustand wiederfindet — bei Cap 1
 * ist der letzte Job praktisch DER Zustand der Seite).
 *
 * Auth auf zwei Wegen (2026-09-13): SSR-Cookie-Session (Web) oder
 * `Authorization: Bearer <Supabase-Access-Token>` (App — sie pollt
 * hier statt lead_gen_jobs direkt zu lesen: keine RLS-Oeffnung der
 * Tabelle mit webhook_secret, eine Wahrheit fuer Statuszeile und
 * Fehlertext, und der App-Poll treibt Self-Heal + Reaper genauso wie
 * der Web-Poll — wichtig, sobald der User den In-App-Browser zumacht
 * und sonst niemand mehr pollt).
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
import type { User } from "@supabase/supabase-js";
import { failedCardMessage, statusLine } from "@/app/lists/job-view";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  ensureSignupGrant,
  getCreditBalance,
  SIGNUP_CREDITS,
} from "@/lib/lists/credits";
import {
  buildListName,
  fetchLatestJobForUser,
  JOB_COLUMNS,
  processJobIfFinished,
  type LeadGenJob,
} from "@/lib/lists/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Der Self-Heal verarbeitet hier den kompletten Job (Outscraper-Fetch,
// Pipeline, Insert, Mail) — mit dem Vercel-Default von 10 s stirbt das
// bei grossen Listen mitten im processing und hinterlaesst einen Haenger.
export const maxDuration = 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bearer-Token zuerst (App), sonst Cookie-Session (Web). Das JWT wird
 * ueber den Admin-Client bei GoTrue verifiziert — ein abgelaufenes oder
 * gefaelschtes Token ist damit einfach "nicht eingeloggt" (401), kein
 * Fehler.
 */
async function authenticate(request: NextRequest): Promise<User | null> {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (bearer) {
    const { data, error } = await getServerSupabase().auth.getUser(bearer);
    return error ? null : data.user;
  }
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobParam = request.nextUrl.searchParams.get("job");
  if (jobParam && !UUID_PATTERN.test(jobParam)) {
    return Response.json({ error: "invalid_job" }, { status: 400 });
  }

  const admin = getServerSupabase();

  // Lazy-Grant: der erste Kontakt eines Accounts mit dem Generator legt
  // die 250 Start-Credits an. Der Kontostand selbst wird erst NACH dem
  // Self-Heal gelesen — der kann gerade eine Lieferung abgerechnet haben.
  await ensureSignupGrant(admin, user.id);
  const readCredits = async () => ({
    balance: await getCreditBalance(admin, user.id),
    signupTotal: SIGNUP_CREDITS,
  });

  let job: LeadGenJob | null;
  if (jobParam) {
    const { data, error } = await admin
      .from("lead_gen_jobs")
      .select(JOB_COLUMNS)
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
    return Response.json({ job: null, credits: await readCredits() });
  }

  // processing laeuft hier nur durch den Haenger-Check in
  // processJobIfFinished — verarbeitet wird ausschliesslich pending.
  if (job.status === "pending" || job.status === "processing") {
    try {
      job = await processJobIfFinished(admin, job);
    } catch (err) {
      // Self-Heal-Fehler nicht an den Client durchreichen — der Job
      // bleibt pending und der naechste Poll probiert es wieder.
      console.error("[lists/status] self-heal failed", err);
    }
  }

  const running = job.status === "pending" || job.status === "processing";
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
      // Fertige Texte fuer beide Clients (Web-Kachel + App-Kachel), damit
      // die Wellen-/Fehler-Logik nur hier lebt.
      statusLine: running ? statusLine(job.params) : null,
      failureMessage: failedCardMessage({
        status: job.status,
        error: job.error,
        params: job.params,
        createdAt: job.created_at,
      }),
    },
    credits: await readCredits(),
  });
}
