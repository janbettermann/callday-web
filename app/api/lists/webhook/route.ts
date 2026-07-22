/**
 * POST /api/lists/webhook — Ziel des Outscraper-Webhooks ("Job fertig").
 *
 * Auth: Job-ID + per-Job-Secret aus der URL, timing-safe gegen die
 * Job-Row geprueft. Der Request-Body wird bewusst ignoriert — die
 * Verarbeitung holt die Ergebnisse authenticated direkt bei Outscraper
 * (Request-ID aus der Job-Row). Ein gespoofter Webhook kann damit
 * hoechstens eine ohnehin faellige Verarbeitung anstossen.
 *
 * Idempotent: processJobIfFinished verarbeitet nur den Uebergang
 * pending→processing; Retries und Doppel-Pings laufen ins Leere.
 */

import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getServerSupabase } from "@/lib/supabase-server";
import { fetchJobById, processJobIfFinished } from "@/lib/lists/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretsMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job");
  const secret = request.nextUrl.searchParams.get("secret");
  if (!jobId || !secret || !UUID_PATTERN.test(jobId)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getServerSupabase();
  const job = await fetchJobById(admin, jobId);
  if (!job || !secretsMatch(job.webhook_secret, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await processJobIfFinished(admin, job);
  return Response.json({ ok: true });
}
