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

/**
 * Hold-Periode in Tagen — die Single Source of Truth. Provisionen sind bis
 * `charged_at + COMMISSION_HOLD_DAYS` im Hold (pending), danach available.
 * Genutzt von der Demo hier, der affiliate-facing Copy (payouts/page.tsx) und
 * — sobald gebaut — dem Accrual im RC-Webhook (Phase B: `hold_until =
 * charged_at + COMMISSION_HOLD_DAYS`). `hold_until` bleibt pro Row gespeichert;
 * eine Änderung hier wirkt nur auf NEUE Accruals. Spec:
 * specs/affiliate-payouts.md §9.
 */
export const COMMISSION_HOLD_DAYS = 30;

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
  /** True für Recovery-Buchungen (`commission_cents < 0`): eine bereits
   *  ausgezahlte Provision wurde nach einem Post-Payout-Refund aus dem Saldo
   *  zurückverrechnet. Die UI rendert sie als "Refund adjustment" statt als
   *  normale Provisions-Zeile. Siehe specs/affiliate-payouts.md §9. */
  isRecovery: boolean;
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
    // Negative Recovery-Beträge netten hier automatisch in ihren Bucket
    // (available += negativ → reduziert den auszahlbaren Saldo). availableCents
    // kann dadurch < 0 werden (Carry — der Affiliate schuldet zurück); die
    // Anzeige-Schicht clamped auf 0 und zeigt den Rest als "to recover".
    if (status === "pending") bucket.pendingCents += r.commission_cents;
    else if (status === "available") bucket.availableCents += r.commission_cents;
    else if (status === "paid") bucket.paidCents += r.commission_cents;
    // 'clawback' zählt in keinen Bucket.
    byCurrency.set(r.charge_currency, bucket);
    return { ...r, status, isRecovery: r.commission_cents < 0 };
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
 * Available-USD-Summe (auszahlbar) pro Affiliate — für den Admin-Payout-View.
 *
 * "available" nutzt EXAKT denselben abgeleiteten Filter wie
 * `mark_commissions_paid` (0043) und die affiliate-facing Earnings-Page:
 * unbezahlt, nicht storniert, Hold vorbei. Kritisch, dass hier dieselbe
 * Ableitung (`deriveCommissionStatus`) läuft — die im Admin ANGEZEIGTE Zahl
 * muss das sein, was der Payout-Run tatsächlich bucht.
 *
 * `commission_cents` ist kanonisch USD (Single-USD-Ledger, siehe
 * specs/affiliate-currency.md) → über alle Rows summierbar, kein
 * Währungs-Split. Ein Row zählt in genau einen Affiliate-Bucket.
 *
 * Anmerkung Zeit: hier `Date.now()` (Render-Zeit), in der Funktion SQL
 * `now()` (Klick-Zeit). Minimaler Drift möglich (eine Provision reift zwischen
 * Anzeige und Klick) — bewusst: der Payout-Run zahlt die Klick-Zeit-Wahrheit
 * und gibt den echten Betrag zurück; die UI zeigt DEN, nicht die Seiten-Zahl.
 */
export async function getPayableByAffiliate(
  affiliateIds: string[],
): Promise<Map<string, number>> {
  if (affiliateIds.length === 0) return new Map();
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("affiliate_commissions")
    .select("affiliate_id, commission_cents, hold_until, paid_at, clawback_at")
    .in("affiliate_id", affiliateIds);
  if (error) throw error;

  const nowMs = Date.now();
  const out = new Map<string, number>();
  for (const row of data ?? []) {
    const r = row as {
      affiliate_id: string;
      commission_cents: number;
      hold_until: string;
      paid_at: string | null;
      clawback_at: string | null;
    };
    if (deriveCommissionStatus(r, nowMs) !== "available") continue;
    out.set(r.affiliate_id, (out.get(r.affiliate_id) ?? 0) + r.commission_cents);
  }
  return out;
}

/**
 * Illustrative Demo-Earnings für den Beta-Demo-Mode (`?demo=1`). REIN Anzeige —
 * schreibt NICHTS in die DB. Realistische Rows in verschiedenen Zuständen,
 * durch dieselbe `computeEarnings`-Ableitung gejagt wie echte Daten.
 */
export function getDemoEarnings(): AffiliateEarnings {
  const now = Date.now();
  const DAY = 86_400_000;
  const H = COMMISSION_HOLD_DAYS;
  const HOLD = H * DAY;
  const monthly = "com.dealswipe.app.pro.monthly";

  // Szenario: ~stabil zahlende Referrals → ~$7.50-Provisionen (50% von $14.99).
  // Die Charge-Fenster sind RELATIV zur Hold-Periode (H) gewählt, damit das
  // Demo automatisch korrekt bleibt, egal ob H = 30 oder 90: alles jünger als H
  // ist pending, das nächste Fenster available, das älteste bereits paid.
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
    // Pending: jünger als der Hold (1 .. H-1 Tage) → im Hold.
    ...batch("p", 100, 1, Math.max(2, H - 1)),
    // Available: Hold vorbei, noch nicht ausgezahlt (H+1 .. H+30).
    ...batch("a", 100, H + 1, H + 30),
    // Paid: älter, bereits ausgezahlt (H+31 .. H+120).
    ...batch("d", 200, H + 31, H + 120, (ms) => ({
      paid_at: new Date(ms + HOLD + 5 * DAY).toISOString(),
    })),
    // In-Hold-Refunds (Reversed) für Realismus — zählen in keinen Bucket.
    ...batch("c", 5, 4, Math.max(5, H), (ms) => ({
      clawback_at: new Date(ms + 3 * DAY).toISOString(),
    })),
    // Refund adjustments (Post-Payout-Refund): 2 bereits ausgezahlte Provisionen
    // wurden vom Kunden zurückerstattet → Negativ-Buchung, sofort available
    // (kein Hold), reduziert den auszahlbaren Saldo. Rendert als rote
    // "Refund adjustment"-Zeile (isRecovery). Bewusst die NEUESTEN Rows (0–1 d),
    // damit sie in der auf 12 gekappten Liste oben sichtbar sind.
    // Siehe specs/affiliate-payouts.md §9.
    ...batch("r", 2, 0, 1, (ms) => ({
      commission_cents: -750,
      hold_until: new Date(ms).toISOString(),
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
