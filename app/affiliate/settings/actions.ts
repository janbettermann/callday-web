"use server";

import { revalidatePath } from "next/cache";

import { getServerSupabase } from "@/lib/supabase-server";
import type { PayoutMethod } from "@/lib/affiliate-payout";

import { requireAffiliateId } from "../require-session";

/**
 * Affiliate-facing Payout-Settings-Actions. Alle scoped auf die eigene
 * affiliate_id (service_role bypassed RLS → Scope MUSS in der Query stehen).
 *
 * Verify-Handshake:
 *   save*   → Daten schreiben, Verify-State zuruecksetzen (Details geaendert)
 *   confirm → Affiliate bestaetigt Eingang der Admin-Testueberweisung
 *   setActive → verifizierte Methode als aktive payout_method waehlen
 * Die Admin-Seite (mark test sent) lebt in app/[secret]/affiliates.
 */

export type PayoutActionState = { error?: string; ok?: boolean } | null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidate(): void {
  revalidatePath("/affiliate/settings");
  revalidatePath("/affiliate/payouts");
}

/**
 * War die gerade editierte Methode die aktive, ist sie nach dem Reset
 * unverifiziert → sie darf nicht mehr aktiv bleiben. payout_method leeren.
 */
async function clearActiveIfMethod(
  affiliateId: string,
  method: PayoutMethod,
): Promise<boolean> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("affiliates")
    .select("payout_method")
    .eq("id", affiliateId)
    .maybeSingle();
  return (data as { payout_method: string | null } | null)?.payout_method === method;
}

export async function savePaypalAction(
  _prev: PayoutActionState,
  formData: FormData,
): Promise<PayoutActionState> {
  const affiliateId = await requireAffiliateId();
  const email = String(formData.get("paypal_email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) return { error: "Enter your PayPal email." };
  if (!EMAIL_REGEX.test(email)) {
    return { error: "That doesn't look like an email." };
  }

  const clearActive = await clearActiveIfMethod(affiliateId, "paypal");
  const sb = getServerSupabase();
  const { error } = await sb
    .from("affiliates")
    .update({
      paypal_email: email,
      paypal_test_sent_at: null,
      paypal_verified_at: null,
      ...(clearActive ? { payout_method: null } : {}),
    })
    .eq("id", affiliateId);

  if (error) return { error: "Couldn't save. Try again." };
  revalidate();
  return { ok: true };
}

export async function saveWiseAction(
  _prev: PayoutActionState,
  formData: FormData,
): Promise<PayoutActionState> {
  const affiliateId = await requireAffiliateId();
  const holder = String(formData.get("wise_account_holder") ?? "").trim();
  const country = String(formData.get("wise_country") ?? "").trim();
  const details = String(formData.get("wise_details") ?? "").trim();

  if (!holder) return { error: "Add the account holder name." };
  if (!country) return { error: "Add the account's country." };
  if (!details) return { error: "Add your account details (IBAN or routing + account number)." };

  const clearActive = await clearActiveIfMethod(affiliateId, "wise");
  const sb = getServerSupabase();
  const { error } = await sb
    .from("affiliates")
    .update({
      wise_account_holder: holder,
      wise_country: country,
      wise_details: details,
      wise_test_sent_at: null,
      wise_verified_at: null,
      ...(clearActive ? { payout_method: null } : {}),
    })
    .eq("id", affiliateId);

  if (error) return { error: "Couldn't save. Try again." };
  revalidate();
  return { ok: true };
}

/**
 * Affiliate bestaetigt, dass die Testueberweisung angekommen ist. Nur erlaubt,
 * wenn die Admin-Seite `*_test_sent_at` gesetzt hat (echter zweiseitiger
 * Handshake — nicht selbst-behauptbar). Ist noch keine Methode aktiv, wird die
 * gerade verifizierte automatisch die aktive (Single-Method-Affiliates muessen
 * den Selektor nie anfassen).
 */
export async function confirmPayoutReceivedAction(
  method: PayoutMethod,
): Promise<PayoutActionState> {
  const affiliateId = await requireAffiliateId();
  if (method !== "paypal" && method !== "wise") {
    return { error: "Invalid method." };
  }
  const sb = getServerSupabase();

  const testCol = `${method}_test_sent_at`;
  const verifiedCol = `${method}_verified_at`;

  const { data } = await sb
    .from("affiliates")
    .select(`payout_method, ${testCol}, ${verifiedCol}`)
    .eq("id", affiliateId)
    .maybeSingle();

  const row = data as unknown as Record<string, string | null> | null;
  if (!row) return { error: "Something went wrong. Try again." };
  if (!row[testCol]) {
    return { error: "No test transfer has been sent yet — hold tight." };
  }
  if (row[verifiedCol]) return { ok: true }; // schon bestaetigt, idempotent

  const now = new Date().toISOString();
  const { error } = await sb
    .from("affiliates")
    .update({
      [verifiedCol]: now,
      // Erste verifizierte Methode wird automatisch aktiv.
      ...(row.payout_method ? {} : { payout_method: method }),
    })
    .eq("id", affiliateId);

  if (error) return { error: "Couldn't confirm. Try again." };
  revalidate();
  return { ok: true };
}

/**
 * Aktive Auszahlungsmethode waehlen. Nur eine VERIFIZIERTE Methode darf aktiv
 * werden (Guard gegen Aktivieren einer unverifizierten).
 */
export async function setActivePayoutMethodAction(
  method: PayoutMethod,
): Promise<PayoutActionState> {
  const affiliateId = await requireAffiliateId();
  if (method !== "paypal" && method !== "wise") {
    return { error: "Invalid method." };
  }
  const sb = getServerSupabase();

  const verifiedCol = `${method}_verified_at`;
  const { data } = await sb
    .from("affiliates")
    .select(verifiedCol)
    .eq("id", affiliateId)
    .maybeSingle();

  const verified = (data as unknown as Record<string, string | null> | null)?.[
    verifiedCol
  ];
  if (!verified) {
    return { error: "Verify this method first." };
  }

  const { error } = await sb
    .from("affiliates")
    .update({ payout_method: method })
    .eq("id", affiliateId);

  if (error) return { error: "Couldn't switch. Try again." };
  revalidate();
  return { ok: true };
}
