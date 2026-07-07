/**
 * Affiliate-Payout-Methoden — geteilte Typen + reine Ableitungs-Logik.
 *
 * CLIENT-SAFE (kein "server-only", kein Supabase-Import) — mirror des
 * affiliate-lifecycle.ts-Patterns: die pure Ableitung lebt hier, damit sowohl
 * Server-Pages (Settings/Payouts) als auch Client-Components (Admin-Drawer,
 * PayoutSettings) sie nutzen koennen. Der DB-Read passiert server-seitig in den
 * Pages via getServerSupabase().select(PAYOUT_COLUMNS) → mapPayout().
 *
 * Verify-State pro Methode wird abgeleitet, nicht gespeichert (siehe Migration
 * 0041). Nur eine VERIFIZIERTE Methode kann die aktive payout_method werden.
 */

export type PayoutMethod = "paypal" | "wise";

/**
 * - unset:     nichts eingegeben
 * - pending:   Daten da, wartet auf die Admin-Testueberweisung
 * - test_sent: Testueberweisung raus, wartet auf Affiliate-Bestaetigung
 * - verified:  Affiliate hat Eingang bestaetigt → auszahlbar
 */
export type PayoutMethodState = "unset" | "pending" | "test_sent" | "verified";

export interface AffiliatePayout {
  activeMethod: PayoutMethod | null;
  paypal: {
    email: string | null;
    state: PayoutMethodState;
  };
  wise: {
    accountHolder: string | null;
    country: string | null;
    details: string | null;
    state: PayoutMethodState;
  };
}

/** Roh-Shape der payout-Spalten auf affiliates (so wie aus Supabase gelesen). */
export interface RawPayout {
  payout_method: PayoutMethod | null;
  paypal_email: string | null;
  paypal_test_sent_at: string | null;
  paypal_verified_at: string | null;
  wise_account_holder: string | null;
  wise_country: string | null;
  wise_details: string | null;
  wise_test_sent_at: string | null;
  wise_verified_at: string | null;
}

/** Die payout-Spalten als SELECT-Liste (eine Quelle fuer alle Reads). */
export const PAYOUT_COLUMNS =
  "payout_method, paypal_email, paypal_test_sent_at, paypal_verified_at, " +
  "wise_account_holder, wise_country, wise_details, wise_test_sent_at, wise_verified_at";

function deriveState(input: {
  configured: boolean;
  testSentAt: string | null;
  verifiedAt: string | null;
}): PayoutMethodState {
  if (!input.configured) return "unset";
  if (input.verifiedAt) return "verified";
  if (input.testSentAt) return "test_sent";
  return "pending";
}

/** Roh-Row → strukturiertes AffiliatePayout mit abgeleiteten States. */
export function mapPayout(raw: RawPayout): AffiliatePayout {
  return {
    activeMethod: raw.payout_method,
    paypal: {
      email: raw.paypal_email,
      state: deriveState({
        configured: !!raw.paypal_email,
        testSentAt: raw.paypal_test_sent_at,
        verifiedAt: raw.paypal_verified_at,
      }),
    },
    wise: {
      accountHolder: raw.wise_account_holder,
      country: raw.wise_country,
      details: raw.wise_details,
      state: deriveState({
        configured: !!raw.wise_details,
        testSentAt: raw.wise_test_sent_at,
        verifiedAt: raw.wise_verified_at,
      }),
    },
  };
}

export function methodLabel(method: PayoutMethod): string {
  return method === "paypal" ? "PayPal" : "Wise";
}

export interface PayoutSummary {
  method: PayoutMethod | null;
  /** kompakte Ziel-Anzeige fuer die Payout-Seite (Email bzw. Kontoinhaber). */
  destination: string | null;
}

/**
 * Kurz-Zusammenfassung fuer die Payout-Seite: welche Methode ist aktiv, wohin
 * geht's. Nur die aktive (= verifizierte) Methode zaehlt.
 */
export function getPayoutSummary(payout: AffiliatePayout | null): PayoutSummary {
  const method = payout?.activeMethod ?? null;
  if (!payout || !method) return { method: null, destination: null };
  // `payout_method` ist nur eine Präferenz — sie zählt nur, solange die Methode
  // auch verifiziert ist. Defensiv gegen Invarianten-Drift (manuelle DB-Edits,
  // künftige Codepfade); der Normalfall hält die Invariante schon über
  // save/confirm/setActive.
  if (payout[method].state !== "verified") {
    return { method: null, destination: null };
  }
  const destination =
    method === "paypal"
      ? payout.paypal.email
      : (payout.wise.accountHolder ?? "your bank account");
  return { method, destination };
}
