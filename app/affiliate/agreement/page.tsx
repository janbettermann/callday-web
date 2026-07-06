import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { AffiliateNav } from "../AffiliateNav";
import { AffiliateFooter } from "../AffiliateFooter";

/**
 * /affiliate/agreement — Container fuer den Affiliate-Vertrag. Der finale
 * Text kommt vom Anwalt (Onboarding ist bis dahin geblockt); bis dahin ein
 * ehrlicher Platzhalter. Wenn der Text da ist, ersetzt er die Platzhalter-Card.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agreement · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliateAgreementPage() {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );

  if (!affiliateId) {
    redirect("/affiliate/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AffiliateNav />

      <main
        className="container"
        style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 800 }}
      >
        <Link
          href="/affiliate/dashboard"
          style={{
            display: "inline-block",
            marginBottom: 24,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink-dim)",
            textDecoration: "none",
          }}
        >
          ← Back to dashboard
        </Link>

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
          Affiliate agreement
        </h1>
        <p
          style={{ margin: "0 0 32px", fontSize: 14, color: "var(--ink-dim)" }}
        >
          The terms of the Callday founding-affiliate program.
        </p>

        <section
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ink)",
            }}
          >
            Your affiliate agreement is being finalized.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--ink-dim)",
            }}
          >
            Once it&apos;s ready, the full terms will live right here and
            we&apos;ll email you a copy. Questions in the meantime? Reach us at{" "}
            <a
              href="mailto:hello@callday.io"
              style={{ color: "var(--blue-deep, #2563e8)" }}
            >
              hello@callday.io
            </a>
            .
          </p>
        </section>
      </main>

      <AffiliateFooter />
    </div>
  );
}
