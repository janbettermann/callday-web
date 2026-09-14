/**
 * sendAppDownloadMail — die Post-Signup-Mail ("You're in" + Weg zur App).
 * Gemeinsame Send-Logik fuer:
 *   1. /api/app-download-mail (Email/PW-Sign-Up, nach OTP-Verifikation
 *      auf /confirm)
 *   2. /auth/callback (OAuth-Sign-Up nach PKCE-Exchange)
 *
 * Hiess bis zum App-Store-Launch lib/testflight-invite.ts (und davor, bis
 * 2026-07-05, lib/affiliate-invite.ts — seit der Vereinheitlichung des
 * Sign-Ups nutzt die organische Landing dieselbe SignupForm wie /a/[slug]).
 * Welche Variante rausgeht, entscheidet APP_STORE_LIVE (lib/app-download.ts):
 * seit dem Launch die Store-Download-Mail, im Beta-Zweig die TestFlight-
 * 2-Step-Anleitung.
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
import { AppStoreDownload } from "@/emails/app-store-download";
import { APP_STORE_LIVE, APP_STORE_URL } from "@/lib/app-download";

export interface SendAppDownloadMailResult {
  status: "sent" | "failed" | "skipped";
  resendEmailId: string | null;
  error: string | null;
}

export async function sendAppDownloadMail(input: {
  toEmail: string;
  displayName: string;
}): Promise<SendAppDownloadMailResult> {
  // Ab APP_STORE_LIVE ersetzt die Store-Download-Mail die TestFlight-
  // Anleitung — der Env-Link wird dann nicht mehr gebraucht.
  const testflightLink = process.env.TESTFLIGHT_PUBLIC_LINK;
  if (!APP_STORE_LIVE && !testflightLink) {
    console.error("[sendAppDownloadMail] TESTFLIGHT_PUBLIC_LINK missing");
    return {
      status: "failed",
      resendEmailId: null,
      error: "TESTFLIGHT_PUBLIC_LINK not configured",
    };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[sendAppDownloadMail] RESEND_API_KEY missing — skipped");
    // Resend-Key-Absenz tracken wir in email_logs nicht — "skipped"-Returns
    // dort als sonderspalte zu pflegen ist over-engineering fuer ein
    // Dev-Setup-Edge-Case.
    return { status: "skipped", resendEmailId: null, error: null };
  }

  const resend = new Resend(resendKey);

  let result: SendAppDownloadMailResult = {
    status: "sent",
    resendEmailId: null,
    error: null,
  };

  // Der ""-Fallback ist toter Code (Guard oben), haelt aber den Typ
  // stabil — testflightLink ist im Beta-Zweig immer gesetzt.
  const mail = APP_STORE_LIVE
    ? {
        subject: "You're in — download Callday",
        react: AppStoreDownload({
          name: input.displayName,
          appStoreLink: APP_STORE_URL,
        }),
      }
    : {
        subject: "You're in — install Callday from TestFlight",
        react: ApplicationConfirmation({
          name: input.displayName,
          testflightLink: testflightLink ?? "",
        }),
      };

  try {
    const sendResult = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [input.toEmail],
      replyTo: "hello@callday.io",
      subject: mail.subject,
      react: mail.react,
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
  // User ueber den Account-Sign-Up kam (keine application-row; die
  // applications-Tabelle ist seit 2026-07-05 historisch). Der Log-Typ
  // heisst weiterhin 'testflight_invite': der CHECK-Constraint auf
  // email_logs.email_type kennt keinen neueren Wert, und die Store-Mails
  // sollen mit den historischen Rows in einer Reihe stehen — umbenennen
  // waere eine Migration ohne Nutzen.
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
        "[sendAppDownloadMail] email_logs insert failed",
        logResult.error,
      );
    }
  }

  return result;
}
