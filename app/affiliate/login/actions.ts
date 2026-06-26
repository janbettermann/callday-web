"use server";

import { Resend } from "resend";

import { getServerSupabase } from "@/lib/supabase-server";
import { AffiliateMagicLink } from "@/emails/affiliate-magic-link";
import {
  buildMagicLinkUrl,
  generateMagicLink,
} from "@/lib/affiliate-auth";

/**
 * Server-Action fuer den /affiliate/login Form.
 *
 * Wichtig: Email-Enumeration-Schutz. Wir returnen IMMER `success` —
 * egal ob die Email in affiliates existiert oder nicht. Nur bei
 * intern errors (DB-Failure, Mail-Failure) returnen wir `failed`.
 *
 * Unknown / Removed / Paused → silent fail (kein Mailversand,
 * kein User-facing-Error). Affiliates die schon paused sind koennen
 * sich theoretisch noch einloggen aber Dashboard zeigt "paused" State.
 */

interface ActionResult {
  ok: boolean;
  email?: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestMagicLinkAction(
  formData: FormData,
): Promise<ActionResult> {
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailRaw || !EMAIL_REGEX.test(emailRaw)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const sb = getServerSupabase();
  const { data: affiliate, error: lookupErr } = await sb
    .from("affiliates")
    .select("id, name, email, status")
    .eq("email", emailRaw)
    .maybeSingle();

  if (lookupErr) {
    console.error("[/affiliate/login] lookup failed", lookupErr);
    // Silent für den User — sehe oben.
    return { ok: true, email: emailRaw };
  }

  // Unknown email oder removed-Affiliate → silent success ohne Mail.
  if (!affiliate || (affiliate as { status: string }).status === "removed") {
    return { ok: true, email: emailRaw };
  }

  const aff = affiliate as {
    id: string;
    name: string;
    email: string;
    status: string;
  };

  // Magic-Link-Token (15 Min TTL) erzeugen.
  const linkResult = await generateMagicLink({
    affiliateId: aff.id,
    purpose: "regular",
  });

  if (!linkResult.ok) {
    // Rate-limited → wir sagen es dem User dass zu viele Anfragen
    // kamen, damit er nicht endlos klickt. Andere errors silent.
    if (linkResult.error === "rate_limited") {
      return {
        ok: false,
        error:
          "Too many sign-in requests recently. Please wait an hour before trying again.",
      };
    }
    return { ok: true, email: emailRaw };
  }

  const signInUrl = buildMagicLinkUrl(linkResult.token);

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[/affiliate/login] RESEND_API_KEY missing");
    return { ok: true, email: emailRaw };
  }

  const resend = new Resend(resendKey);
  try {
    const result = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [aff.email],
      replyTo: "hello@callday.io",
      subject: "Your Callday affiliate sign-in link",
      react: AffiliateMagicLink({
        name: aff.name,
        signInUrl,
      }),
    });
    if (result.error) {
      console.error(
        "[/affiliate/login] resend send error",
        result.error,
      );
    }

    // email_logs-Eintrag (email_type='custom' weil affiliate_magic_link
    // nicht im check-constraint enum steht).
    await sb.from("email_logs").insert({
      application_id: null,
      email_type: "custom",
      resend_email_id: result.data?.id ?? null,
      status: result.error ? "failed" : "sent",
      error_message: result.error?.message ?? null,
    });
  } catch (err) {
    console.error("[/affiliate/login] resend threw", err);
  }

  return { ok: true, email: emailRaw };
}
