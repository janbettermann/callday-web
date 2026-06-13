/**
 * POST /api/beta/apply
 *
 * Beta-Application-Form-Submit-Handler. Validiert das eingegangene
 * Form-Payload, schreibt eine Zeile in public.applications (status='pending'),
 * versendet die Confirmation-Email via Resend und loggt den Versand in
 * public.email_logs.
 *
 * Wire-Format: snake_case durchgehend (matched DB-Schema). Form muss
 * snake_case-Keys senden.
 *
 * Responses:
 *   200 { success: true,   application_id }   — neu angelegt + Email raus
 *   200 { success: true,   duplicate: true }  — Email schon im System (idempotent)
 *   400 { error: string }                     — Validation-Fail
 *   500 { error: string }                     — unerwarteter Fehler
 *
 * Idempotenz: UNIQUE-Constraint auf applications.email faengt Duplikate ab.
 * Wir geben 200 zurueck (nicht 409), damit das Form-UI dieselbe Success-State
 * rendern kann. So gibt es keinen Daten-Leak ueber "ist diese Email registriert".
 */

import { NextRequest } from "next/server";
import { Resend } from "resend";
import { getServerSupabase } from "@/lib/supabase-server";
import { ApplicationConfirmation } from "@/emails/application-confirmation";

// Route bewusst dynamic — Form-Submits sind nie cachebar
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ApplicationPayload {
  name?: unknown;
  email?: unknown;
  website?: unknown;
  cold_calls_per_week?: unknown;
  what_they_sell?: unknown;
  current_tool?: unknown;
  has_ios17?: unknown;
}

interface ValidatedApplication {
  name: string;
  email: string;
  website: string | null;
  cold_calls_per_week: string;
  what_they_sell: string | null;
  current_tool: string;
  has_ios17: boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Basic RFC-5321-ish email check. Wir verlassen uns auf die DB-UNIQUE und
// Resend-Bounce-Handling fuer die echten Edge-Cases. Hier reicht ein Sanity-
// Check, damit "test" oder "foo@bar" nicht durchgehen.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body: ApplicationPayload):
  | { ok: true; data: ValidatedApplication }
  | { ok: false; error: string } {
  if (!isNonEmptyString(body.name)) {
    return { ok: false, error: "name is required" };
  }
  if (!isNonEmptyString(body.email) || !EMAIL_REGEX.test(body.email.trim())) {
    return { ok: false, error: "valid email is required" };
  }
  if (!isNonEmptyString(body.cold_calls_per_week)) {
    return { ok: false, error: "cold_calls_per_week is required" };
  }
  if (!isNonEmptyString(body.current_tool)) {
    return { ok: false, error: "current_tool is required" };
  }
  if (body.has_ios17 !== true) {
    return {
      ok: false,
      error:
        "Callday is currently iOS 17+ only — please check back once you upgrade.",
    };
  }

  return {
    ok: true,
    data: {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      website: nullableString(body.website),
      cold_calls_per_week: body.cold_calls_per_week.trim(),
      what_they_sell: nullableString(body.what_they_sell),
      current_tool: body.current_tool.trim(),
      has_ios17: true,
    },
  };
}

export async function POST(request: NextRequest) {
  let body: ApplicationPayload;
  try {
    body = (await request.json()) as ApplicationPayload;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const result = validate(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const application = result.data;

  const supabase = getServerSupabase();

  // INSERT — UNIQUE-Constraint auf email faengt Duplikate ab.
  // .select('id').single() liefert die neue UUID zurueck, die wir fuer
  // email_logs.application_id brauchen.
  const insertResult = await supabase
    .from("applications")
    .insert(application)
    .select("id")
    .single();

  // Postgres-Code 23505 = unique_violation. Supabase exposed das ueber
  // error.code. Bei Duplikat antworten wir 200 + duplicate:true (siehe
  // Doc-Comment oben — vermeidet Daten-Leak).
  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      return Response.json({ success: true, duplicate: true });
    }
    console.error("[/api/beta/apply] DB insert failed", insertResult.error);
    return Response.json({ error: "could not save application" }, { status: 500 });
  }

  const applicationId = insertResult.data.id as string;

  // Email versenden. Failures hier sollen die Application NICHT zuruecknehmen —
  // Eintrag steht, Jan kann die Bestaetigung manuell nachsenden falls Resend
  // ausfaellt. Wir loggen den Status in email_logs (sent / failed).
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[/api/beta/apply] RESEND_API_KEY missing — skipping email");
    return Response.json({ success: true, application_id: applicationId });
  }

  const resend = new Resend(resendKey);

  let emailLog: {
    application_id: string;
    email_type: "confirmation";
    resend_email_id: string | null;
    status: "sent" | "failed";
    error_message: string | null;
  } = {
    application_id: applicationId,
    email_type: "confirmation",
    resend_email_id: null,
    status: "sent",
    error_message: null,
  };

  try {
    const sendResult = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [application.email],
      replyTo: "hello@callday.io",
      subject: "Got your Callday beta application.",
      react: ApplicationConfirmation({ name: application.name }),
    });

    if (sendResult.error) {
      emailLog.status = "failed";
      emailLog.error_message = sendResult.error.message ?? "unknown send error";
    } else {
      emailLog.resend_email_id = sendResult.data?.id ?? null;
    }
  } catch (err) {
    emailLog.status = "failed";
    emailLog.error_message =
      err instanceof Error ? err.message : "unknown send error";
  }

  // email_logs ist fire-and-forget — Fehler hier brechen nicht ab
  const logResult = await supabase.from("email_logs").insert(emailLog);
  if (logResult.error) {
    console.error("[/api/beta/apply] email_logs insert failed", logResult.error);
  }

  return Response.json({ success: true, application_id: applicationId });
}
