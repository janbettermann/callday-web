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
} from "@/lib/affiliate-commissions";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  PAYOUT_COLUMNS,
  mapPayout,
  getPayoutSummary,
  type RawPayout,
  type PayoutSummary,
} from "@/lib/affiliate-payout";
import { AffiliateNav } from "../AffiliateNav";
import { AffiliateFooter } from "../AffiliateFooter";
import { affiliateMainStyle } from "../layout-styles";
import { MethodMark } from "../MethodMark";
import { EarningsFeed } from "./EarningsFeed";

/**
 * /affiliate/payouts — die Earnings-Sicht des Affiliates. Zeigt Pending /
 * Available / Paid (pro Währung, abgeleiteter Status) + wie die Auszahlung
 * funktioniert. Bis die RC-Accrual zum Launch live ist, ist die Tabelle leer
 * und die Page zeigt ehrliche Nullen + den Explainer.
 * Spec: callday-web/specs/affiliate-payouts.md.
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
  const earnings = demo
    ? getDemoEarnings()
    : await getAffiliateEarnings(affiliateId);
  // Aktuell zahlende Referrals (aggregiert, kein PII). Demo passend zum Szenario.
  const activeReferrals = demo ? 100 : await getActiveReferralCount(affiliateId);

  // Aktive Auszahlungsmethode (read-only Zusammenfassung — Einrichtung lebt in
  // /affiliate/settings). Reflektiert die echte Config, unabhaengig vom Demo.
  const sb = getServerSupabase();
  const { data: payoutRow } = await sb
    .from("affiliates")
    .select(PAYOUT_COLUMNS)
    .eq("id", affiliateId)
    .maybeSingle();
  const payoutSummary = getPayoutSummary(
    payoutRow ? mapPayout(payoutRow as unknown as RawPayout) : null,
  );

  // Ohne Daten: eine Null-Zeile in EUR, damit die Karten sinnvoll rendern.
  const buckets =
    earnings.byCurrency.length > 0
      ? earnings.byCurrency
      : [{ currency: "EUR", pendingCents: 0, availableCents: 0, paidCents: 0 }];
  const showCurrency = buckets.length > 1;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AffiliateNav />

      <main className="container" style={affiliateMainStyle}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.8px",
            lineHeight: 1.1,
            margin: "0 0 6px",
            color: "var(--ink)",
          }}
        >
          Payouts
        </h1>
        <p
          style={{ margin: "0 0 32px", fontSize: 14, color: "var(--ink-dim)" }}
        >
          Your commission earnings and how they&apos;re paid out.
        </p>

        {demo ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              background: "rgba(185,126,16,0.1)",
              border: "0.5px solid rgba(185,126,16,0.3)",
              borderRadius: 16,
              padding: "12px 16px",
              marginBottom: 24,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--sun-deep)",
                lineHeight: 1.4,
              }}
            >
              Demo mode — illustrative numbers, not your real earnings.
            </span>
            <Link
              href="/affiliate/payouts"
              style={{
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 500,
                color: "#ffffff",
                background: "var(--sun-deep)",
                borderRadius: 100,
                padding: "6px 14px",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Exit demo
            </Link>
          </div>
        ) : null}

        {buckets.map((b, idx) => (
          <div key={b.currency} style={{ marginBottom: 24 }}>
            {showCurrency ? (
              <div
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "var(--ink-faint)",
                  marginBottom: 10,
                }}
              >
                {b.currency}
              </div>
            ) : null}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              {idx === 0 ? (
                <MoneyCard
                  label="Active referrals"
                  value={String(activeReferrals)}
                  hint="Earning you recurring commission"
                  dot
                />
              ) : null}
              <MoneyCard
                label="Pending"
                value={formatMoney(b.pendingCents, b.currency)}
                hint="In the 90-day hold"
              />
              <MoneyCard
                label="Available"
                value={formatMoney(b.availableCents, b.currency)}
                hint="Ready for payout"
              />
              <MoneyCard
                label="Paid out"
                value={formatMoney(b.paidCents, b.currency)}
                hint="Already sent to you"
              />
            </div>
          </div>
        ))}

        {/* === Wohin gezahlt wird (read-only; Einrichtung in /settings) === */}
        <PayoutDestination summary={payoutSummary} />

        {/* === How it works — „You're in"-Card-Stil (blauer Tint + Border) === */}
        <section
          style={{
            background:
              "linear-gradient(180deg, rgba(37,99,232,0.06) 0%, rgba(255,255,255,1) 100%)",
            border: "0.5px solid rgba(37,99,232,0.3)",
            borderRadius: 24,
            padding: 28,
            marginBottom: 24,
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "var(--ink-faint)",
              marginBottom: 14,
            }}
          >
            How payouts work
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 14,
              color: "var(--ink-dim)",
              lineHeight: 1.5,
            }}
          >
            <li>
              You earn <strong style={{ color: "var(--ink)" }}>50%</strong> of
              every payment your referrals make — for as long as they stay
              subscribed.
            </li>
            <li>
              Each commission is held for{" "}
              <strong style={{ color: "var(--ink)" }}>90 days</strong> to cover
              refunds, then moves to <em>Available</em>.
            </li>
            <li>
              Available earnings are paid out via{" "}
              <strong>PayPal or Wise</strong> — set your method in{" "}
              <Link
                href="/affiliate/settings"
                style={{ color: "var(--blue-deep)", textDecoration: "none" }}
              >
                Settings
              </Link>
              .
            </li>
          </ul>
        </section>

        {/* === Earnings list === */}
        <section
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          {earnings.hasAny ? (
            <EarningsFeed rows={earnings.rows} />
          ) : (
            <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 14 }}>
              Your earnings will show here once your referrals subscribe.
            </p>
          )}
        </section>

        {!demo && !earnings.hasAny ? (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Link
              href="/affiliate/payouts?demo=1"
              style={{
                display: "inline-block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--ink-dim)",
                background: "#ffffff",
                border: "0.5px solid var(--line)",
                borderRadius: 100,
                padding: "8px 16px",
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
              }}
            >
              Preview with demo data
            </Link>
          </div>
        ) : null}
      </main>

      <AffiliateFooter />
    </div>
  );
}

/**
 * Read-only Zeile „wohin geht die Auszahlung". Reflektiert die aktive (=
 * verifizierte) Methode aus den Settings; „Change" bzw. „Set up" routen dahin.
 * Bewusst nur eine Spiegelung — die Payout-Seite bleibt Status, konfiguriert
 * wird in /affiliate/settings.
 */
function PayoutDestination({ summary }: { summary: PayoutSummary }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 18,
        padding: "16px 20px",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
      }}
    >
      {summary.method ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                color: "var(--ink-faint)",
                whiteSpace: "nowrap",
              }}
            >
              Paid to
            </span>
            <MethodMark method={summary.method} height={16} />
            {summary.destination ? (
              <span
                style={{
                  fontSize: 14,
                  color: "var(--ink-dim)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {summary.destination}
              </span>
            ) : null}
          </div>
          <Link href="/affiliate/settings" style={changeLinkStyle}>
            Change
          </Link>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, color: "var(--ink-dim)" }}>
            Add a payout method to get paid.
          </span>
          <Link href="/affiliate/settings" style={changeLinkStyle}>
            Set up →
          </Link>
        </>
      )}
    </div>
  );
}

const changeLinkStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--blue-deep)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function MoneyCard({
  label,
  value,
  hint,
  dot,
}: {
  label: string;
  value: string;
  hint: string;
  dot?: boolean;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 18,
        padding: "18px 20px",
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-label)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          color: "var(--ink-faint)",
        }}
      >
        {dot ? (
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 8px rgba(34,197,94,0.55)",
              animation: "pulse 2.4s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
        ) : null}
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.6px",
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: "var(--ink-faint)",
          lineHeight: 1.4,
        }}
      >
        {hint}
      </div>
    </div>
  );
}
