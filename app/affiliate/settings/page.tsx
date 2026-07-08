import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { getServerSupabase } from "@/lib/supabase-server";
import { PAYOUT_COLUMNS, mapPayout, type RawPayout } from "@/lib/affiliate-payout";

import { AffiliateNav } from "../AffiliateNav";
import { AffiliateFooter } from "../AffiliateFooter";
import { affiliateMainStyle } from "../layout-styles";
import { PayoutSettings } from "./PayoutSettings";

/**
 * /affiliate/settings — Payout-Methoden-Einrichtung (self-service PayPal/Wise
 * + Verify-Handshake) plus ein schlanker read-only Account-Block. Die
 * Auszahlungs-BETRÄGE leben auf /affiliate/payouts; hier wird nur konfiguriert,
 * WOHIN gezahlt wird.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliateSettingsPage() {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );
  if (!affiliateId) redirect("/affiliate/login");

  const sb = getServerSupabase();
  const { data } = await sb
    .from("affiliates")
    .select(`email, ${PAYOUT_COLUMNS}`)
    .eq("id", affiliateId)
    .maybeSingle();

  if (!data) redirect("/affiliate/login");

  const row = data as unknown as { email: string } & RawPayout;
  const payout = mapPayout(row);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AffiliateNav />

      <main className="container" style={affiliateMainStyle}>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.8px",
              lineHeight: 1.1,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Settings
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--ink-dim)" }}>
            Where your commission gets paid, and your account.
          </p>
        </header>

        {/* === Payout method === */}
        <SectionLabel>Payout method</SectionLabel>
        <div style={{ marginBottom: 32 }}>
          <PayoutSettings payout={payout} />
        </div>

        {/* === Account === */}
        <SectionLabel>Account</SectionLabel>
        <section
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 20,
            padding: 22,
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-dim)",
                marginBottom: 4,
              }}
            >
              Sign-in email
            </div>
            <div style={{ fontSize: 15, color: "var(--ink)" }}>{row.email}</div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "var(--ink-faint)",
                lineHeight: 1.4,
              }}
            >
              This is where your sign-in links go. Need to change it?{" "}
              <a
                href="mailto:hello@callday.io"
                style={{ color: "var(--blue-deep)", textDecoration: "none" }}
              >
                Contact us
              </a>
              .
            </div>
          </div>

          <div style={{ borderTop: "0.5px solid var(--line)" }} />

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-dim)",
                marginBottom: 4,
              }}
            >
              Agreement
            </div>
            <Link
              href="/affiliate/agreement"
              style={{
                fontSize: 15,
                color: "var(--blue-deep)",
                textDecoration: "none",
              }}
            >
              View your affiliate agreement →
            </Link>
          </div>
        </section>
      </main>

      <AffiliateFooter />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-label)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "var(--ink-faint)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
