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

/**
 * Reine Ableitung: raw rows → Buckets (pro Währung) + Rows mit abgeleitetem
 * Status. Geteilt von `getAffiliateEarnings` (echt) und `getDemoEarnings`
 * (Beta-Demo) — die Demo-Daten laufen durch exakt dieselbe Logik.
 */
function computeEarnings(raw: CommissionRaw[]): AffiliateEarnings {
  const nowMs = Date.now();
  const byCurrency = new Map<string, CurrencyEarnings>();

  // Neueste zuerst (der DB-Pfad sortiert schon in der Query; hier nochmal, damit
  // computeEarnings unabhängig von der Input-Reihenfolge korrekt ist — v.a. für
  // die Demo-Daten, die batchweise erzeugt werden).
  const sorted = [...raw].sort((a, b) =>
    b.charged_at.localeCompare(a.charged_at),
  );

  const rows: CommissionRow[] = sorted.map((r) => {
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

  return computeEarnings((data ?? []) as CommissionRaw[]);
}

/**
 * Anzahl aktuell zahlender Referrals (Subscription `active`) — aggregiert,
 * kein PII, für die „Active referrals"-Stat-Card. `subscription_status` wird
 * vom `revenuecat-webhook` auf `profiles` gepflegt.
 */
export async function getActiveReferralCount(
  affiliateId: string,
): Promise<number> {
  const sb = getServerSupabase();
  const { count } = await sb
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_affiliate_id", affiliateId)
    .eq("subscription_status", "active");
  return count ?? 0;
}

/**
 * Illustrative Demo-Earnings für den Beta-Demo-Mode (`?demo=1`). REIN Anzeige —
 * schreibt NICHTS in die DB. Realistische Rows in verschiedenen Zuständen,
 * durch dieselbe `computeEarnings`-Ableitung gejagt wie echte Daten.
 */
export function getDemoEarnings(): AffiliateEarnings {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOLD = 90 * DAY;
  const monthly = "com.dealswipe.app.pro.monthly";

  // Szenario: ~100 zahlende Referrals, ~6 Monate ~stabil → ~100 $7.50-Provisionen
  // (50% von $14.99) pro Monat. Der 90-Tage-Hold sperrt die letzten 3 Monate der
  // Charges (pending); was danach reift, ist available bzw. schon paid. Ergibt
  // eine ~3:1-Relation pending:available, die direkt das 90-Tage-Fenster spiegelt.
  const batch = (
    prefix: string,
    count: number,
    minDaysAgo: number,
    maxDaysAgo: number,
    extra?: (chargedAtMs: number) => Partial<CommissionRaw>,
  ): CommissionRaw[] =>
    Array.from({ length: count }, (_, i) => {
      const daysAgo =
        minDaysAgo + ((maxDaysAgo - minDaysAgo) * i) / Math.max(1, count - 1);
      const chargedAtMs = now - daysAgo * DAY;
      return {
        id: `${prefix}-${i}`,
        charged_at: new Date(chargedAtMs).toISOString(),
        hold_until: new Date(chargedAtMs + HOLD).toISOString(),
        commission_cents: 750,
        charge_currency: "USD",
        product_id: monthly,
        clawback_at: null,
        paid_at: null,
        ...extra?.(chargedAtMs),
      };
    });

  const raw: CommissionRaw[] = [
    // Pending: letzte 3 Monate im Hold → 300 × $7.50 = $2,250
    ...batch("p", 300, 1, 89),
    // Available: Hold vorbei, noch nicht ausgezahlt → 100 × $7.50 = $750
    ...batch("a", 100, 91, 120),
    // Paid: früher ausgezahlt → 200 × $7.50 = $1,500
    ...batch("d", 200, 121, 180, (ms) => ({
      paid_at: new Date(ms + HOLD + 5 * DAY).toISOString(),
    })),
    // Ein paar Reversed (Refunds) für Realismus — zählen in keinen Bucket
    ...batch("c", 5, 4, 40, (ms) => ({
      clawback_at: new Date(ms + 3 * DAY).toISOString(),
    })),
  ];

  return computeEarnings(raw);
}

/** Cents → lokalisierte Währungs-Anzeige, z.B. 1499 EUR → „€14.99". */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
