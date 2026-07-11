/**
 * POST /api/lists/generate — startet einen Lead-Generator-Job.
 *
 * Auth: eingeloggter User (SSR-Cookie-Session). Free-Cap (1 Gratis-Liste
 * pro Konto) wird DB-seitig vom partial unique index erzwungen — der
 * 23505-Fall wird hier in ein sauberes 409 uebersetzt.
 *
 * Der Outscraper-Webhook zeigt auf /api/lists/webhook mit Job-ID +
 * per-Job-Secret in der URL; die Ergebnisse selbst holt die Verarbeitung
 * authenticated bei Outscraper (siehe lib/lists/jobs.ts).
 */

import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  OUTSCRAPER_FETCH_LIMIT,
  findCountry,
} from "@/lib/lists/config";
import { startGoogleMapsSearch } from "@/lib/lists/outscraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FIELD_MAX_LENGTH = 60;

/**
 * Freitext-Feld saeubern: Kommas/Zeilenumbrueche raus (die Query wird
 * komma-separiert an Outscraper gebaut), Whitespace normalisieren.
 */
function cleanField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[,\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= FIELD_MAX_LENGTH
    ? cleaned
    : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { industry, city, country } = (body ?? {}) as Record<string, unknown>;
  const cleanIndustry = cleanField(industry);
  const cleanCity = cleanField(city);
  const countryConfig = findCountry(country);
  if (!cleanIndustry || !cleanCity || !countryConfig) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const admin = getServerSupabase();
  const webhookSecret = randomBytes(24).toString("base64url");
  const query = `${cleanIndustry}, ${cleanCity}`;

  const { data: job, error: insertError } = await admin
    .from("lead_gen_jobs")
    .insert({
      user_id: user.id,
      params: {
        industry: cleanIndustry,
        city: cleanCity,
        country: countryConfig.code,
      },
      query,
      webhook_secret: webhookSecret,
      is_free: true,
    })
    .select("id")
    .single();

  if (insertError || !job) {
    if (insertError?.code === "23505") {
      return Response.json({ error: "free_list_used" }, { status: 409 });
    }
    console.error("[lists/generate] job insert failed", insertError);
    return Response.json({ error: "job_create_failed" }, { status: 500 });
  }

  const webhookUrl = `${request.nextUrl.origin}/api/lists/webhook?job=${job.id}&secret=${webhookSecret}`;

  try {
    const requestId = await startGoogleMapsSearch({
      query,
      limit: OUTSCRAPER_FETCH_LIMIT,
      region: countryConfig.code,
      language: countryConfig.language,
      webhookUrl,
    });
    await admin
      .from("lead_gen_jobs")
      .update({ outscraper_request_id: requestId })
      .eq("id", job.id);
  } catch (err) {
    console.error("[lists/generate] outscraper start failed", err);
    // failed gibt den Free-Slot wieder frei (partial index exkludiert failed).
    await admin
      .from("lead_gen_jobs")
      .update({
        status: "failed",
        error: "outscraper_start_failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return Response.json({ error: "generator_unavailable" }, { status: 502 });
  }

  return Response.json({ jobId: job.id });
}
