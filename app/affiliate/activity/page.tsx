import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CalldayLogo } from "../../components/CalldayLogo";
import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { getAffiliateActivity } from "@/lib/affiliate-activity";
import { ActivityList } from "../ActivityList";

/**
 * /affiliate/activity — vollständige Activity-Liste (Views + Sign-ups).
 * Das Dashboard zeigt nur die letzten 10 + einen Link hierher. Gleiche
 * Datenquelle (getAffiliateActivity) und dieselbe ActivityList-Komponente.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliateActivityPage() {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );

  if (!affiliateId) {
    redirect("/affiliate/login");
  }

  const { activity } = await getAffiliateActivity(affiliateId);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <nav className="site-nav" data-scrolled="true">
        <div className="container nav-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            <CalldayLogo size={32} />
            Callday
          </Link>
        </div>
      </nav>

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
          All activity
        </h1>
        <p
          style={{ margin: "0 0 32px", fontSize: 14, color: "var(--ink-dim)" }}
        >
          Every visitor and sign-up through your link.
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
          <ActivityList activity={activity} />
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="logo">
            <CalldayLogo size={28} />
            Callday
          </div>
          <div className="footer-tagline">MAKE TODAY A CALLDAY.</div>
          <div className="footer-meta">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/terms#imprint">Imprint</Link>
            <a href="mailto:hello@callday.io">hello@callday.io</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
