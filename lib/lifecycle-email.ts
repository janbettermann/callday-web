/**
 * Shared Handler für Status-Lifecycle-Webhooks (applications.status →
 * 'launch_list' triggert die Launch-List-Welcome-Mail).
 *
 * Aktuell nur noch von send-launch-list-welcome benutzt. Der ehemalige
 * Zwilling send-testflight-invite ist im Juni 2026 entfallen (Instant-
 * Approval statt zweistufigem Flow). Betrifft nur den historischen
 * applications-Bestand — seit 2026-07-05 laufen neue Sign-Ups als
 * Accounts ueber die SignupForm, ohne applications-Row (TestFlight-Mail
 * via lib/testflight-invite.ts). Wrapper-Struktur bleibt, falls später
 * weitere Status-Lifecycle-Mails dazukommen.
 *
 * Auth: Supabase Database Webhook schickt einen custom X-Webhook-Secret-
 * Header (vom User im Studio konfiguriert), wir verifizieren ihn gegen
 * SUPABASE_WEBHOOK_SECRET in den Env-Vars. Mismatch → 401.
 *
 * Idempotenz: Vor dem Send checken wir email_logs auf einen vorhandenen
 * Eintrag mit (email_type, application_id, status='sent'). Wenn da
 * → no-op, return 200. Schützt vor Doppel-Send bei Webhook-Retry oder
 * versehentlichem Status-Toggle.
 *
 * Failure-Mode: Resend-Fehler werden in email_logs mit status='failed' +
 * error_message protokolliert, Response bleibt 200 (kein Retry-Storm).
 * Jan kann failed-Logs manuell auswerten via SQL.
 */

import type { ReactElement } from "react";
import { NextRequest } from "next/server";
import { Resend } from "resend";
import { getServerSupabase } from "./supabase-server";

interface ApplicationRecord {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface SupabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ApplicationRecord | null;
  old_record: ApplicationRecord | null;
}

type LifecycleEmailType = "testflight_invite" | "launch_list_welcome";
type LifecycleStatus = "approved" | "launch_list";

interface LifecycleConfig {
  expectedStatus: LifecycleStatus;
  emailType: LifecycleEmailType;
  subject: string;
  Template: (props: { name: string }) => ReactElement;
}

export async function handleLifecycleWebhook(
  request: NextRequest,
  config: LifecycleConfig,
): Promise<Response> {
  // 1. Auth — Shared-Secret-Header gegen Env-Var prüfen
  const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("[lifecycle-email] SUPABASE_WEBHOOK_SECRET missing");
    return Response.json({ error: "server misconfigured" }, { status: 500 });
  }
  const headerSecret = request.headers.get("x-webhook-secret");
  if (headerSecret !== expectedSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Payload parsen
  let payload: SupabaseWebhookPayload;
  try {
    payload = (await request.json()) as SupabaseWebhookPayload;
  } catch {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  // 3. Nur UPDATE auf applications interessiert uns
  if (payload.type !== "UPDATE" || payload.table !== "applications") {
    return Response.json({ skipped: "not an applications update" });
  }
  if (!payload.record || !payload.old_record) {
    return Response.json({ skipped: "missing record data" });
  }

  // 4. Nur wenn status EXAKT in den expected-Status gewechselt hat.
  //    Verhindert Re-Trigger wenn jemand z.B. notes editiert während
  //    status schon längst 'approved' war.
  if (payload.record.status !== config.expectedStatus) {
    return Response.json({ skipped: "wrong new status" });
  }
  if (payload.old_record.status === config.expectedStatus) {
    return Response.json({ skipped: "status unchanged" });
  }

  const application = payload.record;
  const supabase = getServerSupabase();

  // 5. Idempotenz: existiert schon ein sent-Log für diese Kombi?
  const idempotencyCheck = await supabase
    .from("email_logs")
    .select("id")
    .eq("application_id", application.id)
    .eq("email_type", config.emailType)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (idempotencyCheck.error) {
    console.error(
      "[lifecycle-email] idempotency check failed",
      idempotencyCheck.error,
    );
    // Bei DB-Fehler bewusst KEIN Send — sonst Risk auf Duplikat
    return Response.json(
      { error: "idempotency check failed" },
      { status: 500 },
    );
  }
  if (idempotencyCheck.data) {
    return Response.json({ skipped: "already sent" });
  }

  // 6. Email versenden
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[lifecycle-email] RESEND_API_KEY missing");
    return Response.json({ error: "resend not configured" }, { status: 500 });
  }

  const resend = new Resend(resendKey);
  const TemplateComponent = config.Template;

  let logEntry: {
    application_id: string;
    email_type: LifecycleEmailType;
    resend_email_id: string | null;
    status: "sent" | "failed";
    error_message: string | null;
  } = {
    application_id: application.id,
    email_type: config.emailType,
    resend_email_id: null,
    status: "sent",
    error_message: null,
  };

  try {
    const sendResult = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [application.email],
      replyTo: "hello@callday.io",
      subject: config.subject,
      react: TemplateComponent({ name: application.name }),
    });

    if (sendResult.error) {
      logEntry.status = "failed";
      logEntry.error_message =
        sendResult.error.message ?? "unknown send error";
    } else {
      logEntry.resend_email_id = sendResult.data?.id ?? null;
    }
  } catch (err) {
    logEntry.status = "failed";
    logEntry.error_message =
      err instanceof Error ? err.message : "unknown send error";
  }

  // 7. Loggen — Fehler hier brechen nicht ab
  const logResult = await supabase.from("email_logs").insert(logEntry);
  if (logResult.error) {
    console.error("[lifecycle-email] email_logs insert failed", logResult.error);
  }

  return Response.json({
    success: logEntry.status === "sent",
    email_log_status: logEntry.status,
  });
}
