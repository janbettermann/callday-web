import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { getAffiliateActivity } from "@/lib/affiliate-activity";
import { AffiliateNav } from "../AffiliateNav";
import { AffiliateFooter } from "../AffiliateFooter";
import { ActivityFeed } from "../ActivityFeed";
import { affiliateMainStyle } from "../layout-styles";

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
          Link activity
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
          <ActivityFeed activity={activity} />
        </section>
      </main>

      <AffiliateFooter />
    </div>
  );
}
