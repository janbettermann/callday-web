"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";

import {
  ADMIN_SESSION_COOKIE,
  getAdminPath,
  verifySession,
} from "@/lib/admin/auth";
import { getServerSupabase } from "@/lib/supabase-server";
import { AffiliateWelcome } from "@/emails/affiliate-welcome";
import {
  buildMagicLinkUrl,
  generateMagicLink,
} from "@/lib/affiliate-auth";
import type { AffiliateStatus } from "@/lib/admin/affiliate-queries";

/**
 * Admin-Server-Actions fuer das Affiliate-Management.
 *
 * Alle Actions:
 *   1. Pruefen Admin-Auth via Session-Cookie (HMAC-signiert, siehe
 *      lib/admin/auth.ts). Nicht-authed → Generic Error, kein Auth-Leak.
 *   2. Operieren auf service_role-Client (bypassed RLS).
 *   3. Returnen `{ ok: true }` oder `{ ok: false, error }` — Server-
 *      Actions sollen nie unhandled-throwen, sonst kommt Next-500
 *      ohne lesbare Form-Diagnose.
 *
 * State-Refresh nach Mutationen via revalidatePath(adminAffiliatesPath).
 */

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MIN_LENGTH = 2;
const SLUG_MAX_LENGTH = 30;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const adminPath = getAdminPath();
  if (!adminPath) return null;
  const jar = await cookies();
  const sessionCookie = jar.get(ADMIN_SESSION_COOKIE)?.value;
  const ok = await verifySession(sessionCookie);
  return ok ? adminPath : null;
}

function revalidateAffiliates(adminPath: string): void {
  revalidatePath(`/${adminPath}/affiliates`);
}

function validateSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return `Slug must be ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} characters.`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return "Slug must be lowercase letters, numbers and dashes (no leading/trailing dashes).";
  }
  return null;
}

function validateEmail(email: string): string | null {
  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email looks invalid.";
  return null;
}

// =============================================================
// createAffiliate
// =============================================================

export async function createAffiliateAction(
  formData: FormData,
): Promise<ActionResult> {
  const adminPath = await requireAdmin();
  if (!adminPath) return { ok: false, error: "Not authenticated." };

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const founderTier = formData.get("founder_tier") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const slugErr = validateSlug(slug);
  if (slugErr) return { ok: false, error: slugErr };
  if (!name) return { ok: false, error: "Name is required." };
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };

  const sb = getServerSupabase();
  const { error } = await sb.from("affiliates").insert({
    slug,
    name,
    email,
    founder_tier: founderTier,
    notes,
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Slug "${slug}" is already taken.` };
    }
    return { ok: false, error: error.message };
  }

  revalidateAffiliates(adminPath);
  return { ok: true };
}

// =============================================================
// updateAffiliate — Email + Name + Notes editierbar; Slug ist
// Permanent-Link-Garantie und wird hier bewusst NICHT verändert.
// =============================================================

export async function updateAffiliateAction(
  formData: FormData,
): Promise<ActionResult> {
  const adminPath = await requireAdmin();
  if (!adminPath) return { ok: false, error: "Not authenticated." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Affiliate id missing." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const founderTier = formData.get("founder_tier") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };

  const sb = getServerSupabase();
  const { error } = await sb
    .from("affiliates")
    .update({ name, email, founder_tier: founderTier, notes })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAffiliates(adminPath);
  return { ok: true };
}

// =============================================================
// changeStatus — pause / resume / remove. Soft, keine Cascade.
// =============================================================

const VALID_STATUSES: AffiliateStatus[] = ["active", "paused", "removed"];

export async function changeAffiliateStatusAction(
  formData: FormData,
): Promise<ActionResult> {
  const adminPath = await requireAdmin();
  if (!adminPath) return { ok: false, error: "Not authenticated." };

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as AffiliateStatus;

  if (!id) return { ok: false, error: "Affiliate id missing." };
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const sb = getServerSupabase();
  const { error } = await sb
    .from("affiliates")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAffiliates(adminPath);
  return { ok: true };
}

// =============================================================
// resendInvite — Welcome-Mail via Resend triggern. Logge in
// email_logs (email_type 'custom' — der enum hat keinen
// 'affiliate_welcome', custom ist Schema-Compat-Wert).
// =============================================================

export async function resendInviteAction(
  formData: FormData,
): Promise<ActionResult> {
  const adminPath = await requireAdmin();
  if (!adminPath) return { ok: false, error: "Not authenticated." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Affiliate id missing." };

  const sb = getServerSupabase();
  const { data: affiliate, error: fetchErr } = await sb
    .from("affiliates")
    .select("id, slug, name, email, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!affiliate) return { ok: false, error: "Affiliate not found." };
  if (affiliate.status === "removed") {
    return { ok: false, error: "Cannot invite a removed affiliate." };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY is not set." };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://callday.io";
  const affiliateLink = `${baseUrl}/a/${affiliate.slug}`;

  // First-Login-Token (24h-TTL) erzeugen damit der Affiliate direkt aus
  // der Welcome-Mail ins Dashboard kommt ohne nochmal auf /affiliate/login
  // einen neuen Link anfordern zu muessen.
  const linkResult = await generateMagicLink({
    affiliateId: affiliate.id,
    purpose: "first_login",
  });
  if (!linkResult.ok) {
    if (linkResult.error === "rate_limited") {
      return {
        ok: false,
        error: "Too many sign-in links generated recently. Try again in an hour.",
      };
    }
    return { ok: false, error: "Failed to generate sign-in link." };
  }
  const dashboardSignInUrl = buildMagicLinkUrl(linkResult.token);

  const resend = new Resend(resendKey);
  let resendEmailId: string | null = null;
  let status: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;

  try {
    const result = await resend.emails.send({
      from: "Callday <hello@callday.io>",
      to: [affiliate.email],
      replyTo: "hello@callday.io",
      subject: "Welcome to the Callday Founding Affiliates",
      react: AffiliateWelcome({
        name: affiliate.name,
        affiliateLink,
        dashboardSignInUrl,
      }),
    });
    if (result.error) {
      status = "failed";
      errorMessage = result.error.message ?? "unknown send error";
    } else {
      resendEmailId = result.data?.id ?? null;
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : "unknown send error";
  }

  // email_logs — application_id bleibt null, email_type 'custom' weil
  // affiliate_welcome nicht im check-constraint enum steht (Schema-
  // Erweiterung kann spaeter via Migration nachgezogen werden).
  const { error: logErr } = await sb.from("email_logs").insert({
    application_id: null,
    email_type: "custom",
    resend_email_id: resendEmailId,
    status,
    error_message: errorMessage,
  });
  if (logErr) {
    console.error("[affiliates/resendInvite] email_logs insert failed", logErr);
  }

  if (status === "failed") {
    return { ok: false, error: errorMessage ?? "Send failed." };
  }

  // invited_at-Zeitstempel setzen (erste Einladung bzw. Resend stempeln)
  await sb
    .from("affiliates")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", id);

  revalidateAffiliates(adminPath);
  return { ok: true };
}

// =============================================================
// markPayoutTestSent — Jan hat die kleine Testueberweisung an die
// Methode geschickt. Setzt `${method}_test_sent_at` → der Affiliate
// sieht dann in den Settings den Confirm-Button (zweiseitiger
// Verify-Handshake, siehe lib/affiliate-payout.ts).
// =============================================================

export async function markPayoutTestSentAction(
  formData: FormData,
): Promise<ActionResult> {
  const adminPath = await requireAdmin();
  if (!adminPath) return { ok: false, error: "Not authenticated." };

  const id = String(formData.get("id") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  if (!id) return { ok: false, error: "Affiliate id missing." };
  if (method !== "paypal" && method !== "wise") {
    return { ok: false, error: "Invalid method." };
  }

  const sb = getServerSupabase();
  const { error } = await sb
    .from("affiliates")
    .update({ [`${method}_test_sent_at`]: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAffiliates(adminPath);
  return { ok: true };
}
