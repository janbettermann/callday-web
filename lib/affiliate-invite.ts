/**
 * sendTestflightInvite — gemeinsame Mail-Send-Logik fuer:
 *   1. /api/affiliate/post-signup (Email/PW Sign-Up nach OTP-Verifikation,
 *      Resend-Button auf /account)
 *   2. /auth/callback (OAuth Sign-Up nach PKCE-Exchange)
 *
 * Vorher hat /auth/callback die Mail via HTTP-Self-Roundtrip an die API
 * geschickt. Das war fragil (Cookies fehlen, origin ist bei Vercel-Preview
 * nicht trivial) und unnoetig. Eine direkte Funktion ist sauberer.
 *
 * Returnt einen strukturierten Status statt zu throwen — alle Caller
 * loggen Fehler aber unterbrechen den umgebenden Flow nicht.
 */

import { Resend } from "resend";
import { getServerSupabase } from "@/lib/supabase-server";
import { ApplicationConfirmation } from "@/emails/application-confirmation";

export interface SendTestflightInviteResult {
  status: "sent" | "failed" | "skipped";
  resendEmailId: string | null;
  error: string | null;
}

export async function sendTestflightInvite(input: {
  toEmail: string;
  displayName: string;
}): Promise<SendTestflightInviteResult> {
  const testflightLink = process.env.TESTFLIGHT_PUBLIC_LINK;
  if (!testflightLink) {
    console.error("[sendTestflightInvite] TESTFLIGHT_PUBLIC_LINK missing");
    return {
      status: "failed",
      resendEmailId: null,
      error: "TESTFLIGHT_PUBLIC_LINK not configured",
    };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[sendTestflightInvite] RESEND_API_KEY missing — skipped");
    // Resend-Key-Absenz tracken wir in email_logs nicht — "skipped"-Returns
    // dort als sonderspalte zu pflegen ist over-engineering fuer ein
    // Dev-Setup-Edge-Case.
    return { status: "skipped", resendEmailId: null, error: null };
  }

  const resend = new Resend(resendKey);

  let result: SendTestflightInviteResult = {
    status: "sent",
    resendEmailId: null,
    error: null,
  };

  try {
    const sendResult = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [input.toEmail],
      replyTo: "hello@callday.io",
      subject: "You're in — install Callday from TestFlight",
      react: ApplicationConfirmation({
        name: input.displayName,
        testflightLink,
      }),
    });

    if (sendResult.error) {
      result = {
        status: "failed",
        resendEmailId: null,
        error: sendResult.error.message ?? "unknown send error",
      };
    } else {
      result.resendEmailId = sendResult.data?.id ?? null;
    }
  } catch (err) {
    result = {
      status: "failed",
      resendEmailId: null,
      error: err instanceof Error ? err.message : "unknown send error",
    };
  }

  // email_logs ist fire-and-forget — application_id bleibt null da der
  // User ueber Affiliate-Flow kam (keine application-row). Email-Type
  // 'testflight_invite' stimmt mit dem Constraint ueberein.
  if (result.status !== "skipped") {
    const admin = getServerSupabase();
    const logResult = await admin.from("email_logs").insert({
      application_id: null,
      email_type: "testflight_invite",
      resend_email_id: result.resendEmailId,
      status: result.status,
      error_message: result.error,
    });
    if (logResult.error) {
      console.error(
        "[sendTestflightInvite] email_logs insert failed",
        logResult.error,
      );
    }
  }

  return result;
}
