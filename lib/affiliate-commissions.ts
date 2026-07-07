import { getServerSupabase } from "./supabase-server";

/**
 * Affiliate-Provisionen (Read-Side). Der Status wird NICHT gespeichert, sondern
 * aus den Timestamps + `now()` abgeleitet — dieselbe Logik wie die Spec-Query,
 * hier server-seitig in JS gerechnet (kleines Volumen pro Affiliate, kein RPC).
 * Voller Kontext: callday-web/specs/affiliate-payouts.md.
 *
 * Schreibseite (Accrual im revenuecat-webhook) kommt zum Launch — bis dahin ist
 * die Tabelle leer und die Page zeigt ehrliche Nullen.
 */

export type CommissionStatus = "pending" | "available" | "paid" | "clawback";

interface CommissionRaw {
  id: string;
  charged_at: string;
  hold_until: string;
  commission_cents: number;
  charge_currency: string;
  product_id: string | null;
  clawback_at: string | null;
  paid_at: string | null;
}

export interface CommissionRow extends CommissionRaw {
  status: CommissionStatus;
}

export interface CurrencyEarnings {
  currency: string;
  pendingCents: number;
  availableCents: number;
  paidCents: number;
}

export interface AffiliateEarnings {
  /** Aggregierte Buckets pro Währung (nie über Währungen hinweg summiert). */
  byCurrency: CurrencyEarnings[];
  /** Alle Rows (neueste zuerst), Status abgeleitet. */
  rows: CommissionRow[];
  hasAny: boolean;
}

/**
 * Leitet den Status eines Commission-Rows ab. `nowMs` wird reingereicht, damit
 * alle Rows gegen denselben Zeitpunkt geprüft werden.
 */
export function deriveCommissionStatus(
  row: Pick<CommissionRaw, "clawback_at" | "paid_at" | "hold_until">,
  nowMs: number,
): CommissionStatus {
  if (row.clawback_at) return "clawback";
  if (row.paid_at) return "paid";
  if (new Date(row.hold_until).getTime() <= nowMs) return "available";
  return "pending";
}

export async function getAffiliateEarnings(
  affiliateId: string,
): Promise<AffiliateEarnings> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("affiliate_commissions")
    .select(
      "id, charged_at, hold_until, commission_cents, charge_currency, product_id, clawback_at, paid_at",
    )
    .eq("affiliate_id", affiliateId)
    .order("charged_at", { ascending: false });

  const raw = (data ?? []) as CommissionRaw[];
  const nowMs = Date.now();
  const byCurrency = new Map<string, CurrencyEarnings>();

  const rows: CommissionRow[] = raw.map((r) => {
    const status = deriveCommissionStatus(r, nowMs);
    const bucket =
      byCurrency.get(r.charge_currency) ??
      ({
        currency: r.charge_currency,
        pendingCents: 0,
        availableCents: 0,
        paidCents: 0,
      } satisfies CurrencyEarnings);
    if (status === "pending") bucket.pendingCents += r.commission_cents;
    else if (status === "available") bucket.availableCents += r.commission_cents;
    else if (status === "paid") bucket.paidCents += r.commission_cents;
    // 'clawback' zählt in keinen Bucket.
    byCurrency.set(r.charge_currency, bucket);
    return { ...r, status };
  });

  return {
    byCurrency: [...byCurrency.values()],
    rows,
    hasAny: raw.length > 0,
  };
}

/** Cents → lokalisierte Währungs-Anzeige, z.B. 1499 EUR → „€14.99". */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
