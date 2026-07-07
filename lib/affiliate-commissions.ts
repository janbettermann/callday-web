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
 * Illustrative Demo-Earnings für den Beta-Demo-Mode (`?demo=1`). REIN Anzeige —
 * schreibt NICHTS in die DB. Realistische Rows in verschiedenen Zuständen,
 * durch dieselbe `computeEarnings`-Ableitung gejagt wie echte Daten.
 */
export function getDemoEarnings(): AffiliateEarnings {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOLD = 90 * DAY;
  const monthly = "com.dealswipe.app.pro.monthly";
  const yearly = "com.dealswipe.app.pro.yearly";

  const mk = (
    id: string,
    chargedDaysAgo: number,
    cents: number,
    productId: string,
    extra: Partial<CommissionRaw> = {},
  ): CommissionRaw => {
    const chargedAtMs = now - chargedDaysAgo * DAY;
    return {
      id,
      charged_at: new Date(chargedAtMs).toISOString(),
      hold_until: new Date(chargedAtMs + HOLD).toISOString(),
      commission_cents: cents,
      charge_currency: "EUR",
      product_id: productId,
      clawback_at: null,
      paid_at: null,
      ...extra,
    };
  };

  const raw: CommissionRaw[] = [
    // Pending (frisch berechnet, noch im Hold)
    mk("demo-1", 3, 700, monthly),
    mk("demo-2", 21, 700, monthly),
    mk("demo-3", 45, 700, monthly),
    // Available (Hold vorbei)
    mk("demo-4", 100, 700, monthly),
    mk("demo-5", 135, 700, monthly),
    // Paid (schon ausgezahlt) — inkl. eines Jahres-Abos
    mk("demo-6", 200, 700, monthly, {
      paid_at: new Date(now - 105 * DAY).toISOString(),
    }),
    mk("demo-7", 240, 5950, yearly, {
      paid_at: new Date(now - 145 * DAY).toISOString(),
    }),
    // Reversed (Refund im Hold) — zählt in keinen Bucket
    mk("demo-8", 8, 700, monthly, {
      clawback_at: new Date(now - 6 * DAY).toISOString(),
    }),
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
