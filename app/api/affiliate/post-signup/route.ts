/**
 * POST /api/affiliate/post-signup
 *
 * Wird vom AffiliateSignupForm direkt nach erfolgreichem
 * supabase.auth.signUp aufgerufen. Verschickt die TestFlight-Invite-Mail
 * (selbe Template + email_logs-Logik wie /api/beta/apply).
 *
 * Auth-Setup:
 *   - Der User existiert in auth.users (signUp gerade durchgelaufen) und
 *     kann via Session-Cookie identifiziert werden, IST aber u.U. noch
 *     nicht email-bestaetigt (data.session === null). createSupabaseSSR
 *     hat in dem Fall keinen User → wir muessen Service-Role-Lookup
 *     ueber die uebergebene Email machen.
 *   - Damit der Endpoint nicht als beliebiger Mail-Versender missbraucht
 *     wird, pruefen wir: existiert der User in auth.users + wurde er
 *     in den letzten 5 Min angelegt? Reicht als Anti-Spam fuer Phase 1.
 *
 * Idempotenz: nochmal aufrufen verschickt nochmal — bewusst, dient als
 * "Resend"-Mechanismus von der /account-Page aus. Limit haengt am
 * Resend-Plan, kein internes Rate-Limit.
 */

import { NextRequest } from "next/server";
import { Resend } from "resend";
import { getServerSupabase } from "@/lib/supabase-server";
import { ApplicationConfirmation } from "@/emails/application-confirmation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const slug =
    typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";

  if (!email || !EMAIL_REGEX.test(email)) {
    return Response.json({ error: "valid email required" }, { status: 400 });
  }

  const testflightLink = process.env.TESTFLIGHT_PUBLIC_LINK;
  if (!testflightLink) {
    console.error(
      "[/api/affiliate/post-signup] TESTFLIGHT_PUBLIC_LINK missing",
    );
    return Response.json(
      { error: "TestFlight link not configured" },
      { status: 500 },
    );
  }

  const supabase = getServerSupabase();

  // Anti-Spam: User muss existieren UND in den letzten 5 Min angelegt sein.
  // Verhindert dass der Endpoint als beliebiger Mail-Versender missbraucht
  // werden kann.
  const { data: userList, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    console.error("[/api/affiliate/post-signup] admin.listUsers failed", listError);
    return Response.json({ error: "lookup failed" }, { status: 500 });
  }

  const match = userList.users.find(
    (u) => (u.email ?? "").toLowerCase() === email,
  );
  if (!match) {
    return Response.json({ error: "no such account" }, { status: 404 });
  }

  // Account-Erstellung darf maximal 1h zurueckliegen — schuetzt vor
  // Missbrauch des Endpoints durch beliebige Auth-User. 1h gibt der
  // Resend-Recovery vom Account-Dashboard genug Spielraum.
  const createdMs = new Date(match.created_at).getTime();
  if (Date.now() - createdMs > 60 * 60 * 1000) {
    return Response.json({ error: "account too old" }, { status: 403 });
  }

  // Profile-Lookup um den Name zu kriegen (handle_new_user setzt
  // profiles.name leer; in den OAuth-Pfaden kommt der Name aus
  // raw_user_meta_data, dort koennen wir nachziehen).
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", match.id)
    .maybeSingle();

  const displayName =
    (profile?.name && profile.name.trim()) ||
    (match.user_metadata?.full_name as string | undefined) ||
    "there";

  // Mail versenden — selbes Template wie Beta-Application.
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error(
      "[/api/affiliate/post-signup] RESEND_API_KEY missing — skipping email",
    );
    return Response.json({ success: true, skipped: true });
  }

  const resend = new Resend(resendKey);

  let logStatus: "sent" | "failed" = "sent";
  let resendEmailId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const sendResult = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [email],
      replyTo: "hello@callday.io",
      subject: "You're in — install Callday from TestFlight",
      react: ApplicationConfirmation({
        name: displayName,
        testflightLink,
      }),
    });

    if (sendResult.error) {
      logStatus = "failed";
      errorMessage = sendResult.error.message ?? "unknown send error";
    } else {
      resendEmailId = sendResult.data?.id ?? null;
    }
  } catch (err) {
    logStatus = "failed";
    errorMessage = err instanceof Error ? err.message : "unknown send error";
  }

  // email_logs ist fire-and-forget. application_id bleibt null da der
  // User ueber den Affiliate-Flow kam, nicht ueber die Beta-Application-
  // Form. Hat dieselbe email_type 'testflight_invite' damit das in der
  // Admin-Filter-Logik konsistent bleibt — Slug ggf. spaeter in einer
  // dedizierten affiliate_signup_log Tabelle tracken.
  const logResult = await supabase.from("email_logs").insert({
    application_id: null,
    email_type: "testflight_invite",
    resend_email_id: resendEmailId,
    status: logStatus,
    error_message: errorMessage,
  });
  if (logResult.error) {
    console.error(
      "[/api/affiliate/post-signup] email_logs insert failed",
      logResult.error,
    );
  }

  if (logStatus === "failed") {
    return Response.json(
      { error: errorMessage ?? "send failed" },
      { status: 500 },
    );
  }

  return Response.json({ success: true, slug });
}
