import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import {
  getAffiliateActivity,
  computeDailySeries,
} from "@/lib/affiliate-activity";
import { WbPanel } from "@/app/components/werkbank";

import { ActivityFeed } from "../ActivityFeed";
import { ActivityTrendChart, TREND_COLORS } from "../ActivityTrendChart";
import { PortalShell } from "../PortalShell";

/**
 * /affiliate/activity: Trend der letzten 30 Tage und die vollstaendige
 * Liste aller Visitors und Sign-ups mit Filtern.
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

  const act = await getAffiliateActivity(affiliateId);
  const { activity } = act;
  const daily = computeDailySeries(act.allViews, act.allSignups);

  return (
    <PortalShell
      current="activity"
      title="Link activity"
      subtitle="Every visitor and sign-up through your link"
    >
      <WbPanel
        title="Last 30 days"
        subtitle="Per day"
        meta={
          <span className="wb-legend">
            <span className="wb-legend-item">
              <span className="wb-legend-dot" style={{ background: TREND_COLORS.visitors }} />
              Visitors
            </span>
            <span className="wb-legend-item">
              <span className="wb-legend-dot" style={{ background: TREND_COLORS.signups }} />
              Sign-ups
            </span>
          </span>
        }
        padded
      >
        <ActivityTrendChart data={daily} />
      </WbPanel>

      <WbPanel title="Activity" subtitle="Newest first">
        <ActivityFeed activity={activity} />
      </WbPanel>
    </PortalShell>
  );
}
