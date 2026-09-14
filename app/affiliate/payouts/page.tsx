import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import {
  getAffiliateEarnings,
  getActiveReferralCount,
  getDemoEarnings,
  formatMoney,
  COMMISSION_HOLD_DAYS,
} from "@/lib/affiliate-commissions";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  PAYOUT_COLUMNS,
  mapPayout,
  getPayoutSummary,
  type RawPayout,
  type PayoutSummary,
} from "@/lib/affiliate-payout";
import { WbEmpty, WbMetricStrip, WbNotice, WbPanel, type WbMetricItem } from "@/app/components/werkbank";

import { MethodMark } from "../MethodMark";
import { PortalShell } from "../PortalShell";
import { EarningsFeed } from "./EarningsFeed";

/**
 * /affiliate/payouts: die Earnings-Sicht des Affiliates. Pending /
 * Available / Paid (pro Waehrung, abgeleiteter Status) plus wie die
 * Auszahlung funktioniert. Spec: specs/affiliate-payouts.md.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payouts · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliatePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );

  if (!affiliateId) {
    redirect("/affiliate/login");
  }

  // Beta-Demo: `?demo=1` zeigt illustrative Zahlen (rein Anzeige, keine DB).
  const demo = (await searchParams).demo === "1";
  const earnings = demo ? getDemoEarnings() : await getAffiliateEarnings(affiliateId);
  // Aktuell zahlende Referrals (aggregiert, kein PII). Demo passend zum Szenario.
  const activeReferrals = demo ? 100 : await getActiveReferralCount(affiliateId);

  // Aktive Auszahlungsmethode (read-only; Einrichtung lebt in /affiliate/settings).
  const sb = getServerSupabase();
  const { data: payoutRow } = await sb
    .from("affiliates")
    .select(PAYOUT_COLUMNS)
    .eq("id", affiliateId)
    .maybeSingle();
  const payoutSummary = getPayoutSummary(
    payoutRow ? mapPayout(payoutRow as unknown as RawPayout) : null,
  );

  // Ohne Daten: eine Null-Zeile in EUR, damit die Leiste sinnvoll rendert.
  const buckets =
    earnings.byCurrency.length > 0
      ? earnings.byCurrency
      : [{ currency: "EUR", pendingCents: 0, availableCents: 0, paidCents: 0 }];
  const showCurrency = buckets.length > 1;

  return (
    <PortalShell
      current="payouts"
      title="Payouts"
      subtitle="Your commission earnings and how they're paid out"
      actions={
        demo ? (
          <Link href="/affiliate/payouts" className="wb-btn">
            Exit demo
          </Link>
        ) : !earnings.hasAny ? (
          <Link href="/affiliate/payouts?demo=1" className="wb-btn">
            Preview with demo data
          </Link>
        ) : null
      }
    >
      {demo ? <WbNotice>Demo mode: illustrative numbers, not your real earnings.</WbNotice> : null}

      {buckets.map((b, idx) => {
        const items: WbMetricItem[] = [];
        if (idx === 0) {
          items.push({
            key: "referrals",
            label: "Active referrals",
            value: String(activeReferrals),
            sub: "Earning you recurring commission",
          });
        }
        items.push(
          {
            key: "pending",
            label: "Pending",
            value: formatMoney(b.pendingCents, b.currency),
            sub: `In the ${COMMISSION_HOLD_DAYS}-day hold`,
          },
          {
            key: "available",
            label: "Available",
            value: formatMoney(Math.max(0, b.availableCents), b.currency),
            sub:
              b.availableCents < 0
                ? `${formatMoney(-b.availableCents, b.currency)} to recover from upcoming earnings`
                : "Ready for payout",
          },
          {
            key: "paid",
            label: "Paid out",
            value: formatMoney(b.paidCents, b.currency),
            sub: "Already sent to you",
            snapshot: true,
          },
        );
        return (
          <WbPanel
            key={b.currency}
            title={showCurrency ? `Earnings in ${b.currency}` : "Earnings"}
            subtitle="Commissions move from pending to available after the hold"
          >
            <WbMetricStrip items={items} />
          </WbPanel>
        );
      })}

      <WbPanel title="Paid to" subtitle="Set up and verified in Settings" padded>
        <PayoutDestination summary={payoutSummary} />
      </WbPanel>

      <WbPanel title="How payouts work" padded>
        <ul className="wb-list">
          <li>
            You earn <strong>50%</strong> of every payment your referrals make, for as long as they
            stay subscribed.
          </li>
          <li>
            Each commission is held for <strong>{COMMISSION_HOLD_DAYS} days</strong> to cover
            refunds, then moves to <em>Available</em>.
          </li>
          <li>
            Available earnings are paid out via <strong>PayPal or Wise</strong>, set your method
            in{" "}
            <Link href="/affiliate/settings" className="wb-link-blue">
              Settings
            </Link>
            .
          </li>
        </ul>
      </WbPanel>

      <WbPanel title="Commissions" subtitle="Newest first">
        {earnings.hasAny ? (
          <EarningsFeed rows={earnings.rows} />
        ) : (
          <WbEmpty>Your earnings will show here once your referrals subscribe.</WbEmpty>
        )}
      </WbPanel>
    </PortalShell>
  );
}

/**
 * Read-only Zeile "wohin geht die Auszahlung". Reflektiert die aktive
 * (= verifizierte) Methode aus den Settings; "Change" bzw. "Set up"
 * routen dahin.
 */
function PayoutDestination({ summary }: { summary: PayoutSummary }) {
  return (
    <div className="wb-form-row">
      {summary.method ? (
        <>
          <span className="wb-inline" style={{ minWidth: 0 }}>
            <MethodMark method={summary.method} height={16} />
            {summary.destination ? (
              <span
                style={{
                  fontSize: 14,
                  color: "var(--wb-ink-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {summary.destination}
              </span>
            ) : null}
          </span>
          <Link href="/affiliate/settings" className="wb-btn">
            Change
          </Link>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, color: "var(--wb-ink-2)" }}>Add a payout method to get paid.</span>
          <Link href="/affiliate/settings" className="wb-btn-primary is-small">
            Set up
          </Link>
        </>
      )}
    </div>
  );
}
