import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  getAffiliateActivity,
  computePostStats,
  POST_WINDOW_HOURS,
  type PostRow,
} from "@/lib/affiliate-activity";
import { WbNotice, WbPanel, WbStatTile, WbTileGrid } from "@/app/components/werkbank";

import { ActivityList } from "../ActivityList";
import { PortalShell } from "../PortalShell";
import { PostList } from "../PostList";
import { CopyLinkButton } from "./CopyLinkButton";
import { PostComposer } from "./PostComposer";

/**
 * /affiliate/dashboard: der eigene Link, die zwei Zahlen (Visitors,
 * Sign-ups), heutige Posts und die letzten Link-Ereignisse.
 *
 * Auth: Cookie-Gate via verifyAffiliateSession. Removed-Status fliegt im
 * verify schon raus (redirect zu /login). Paused-Affiliates sehen einen
 * Hinweis, haben aber Zugriff.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliateDashboardPage() {
  const jar = await cookies();
  const sessionCookie = jar.get(AFFILIATE_SESSION_COOKIE)?.value;
  const affiliateId = await verifyAffiliateSession(sessionCookie);

  if (!affiliateId) {
    redirect("/affiliate/login");
  }

  const sb = getServerSupabase();

  const { data: affiliate } = await sb
    .from("affiliates")
    .select("slug, status")
    .eq("id", affiliateId)
    .maybeSingle();

  if (!affiliate) {
    redirect("/affiliate/login");
  }

  const aff = affiliate as {
    slug: string;
    status: "active" | "paused" | "removed";
  };

  // Views + Sign-ups + abgeleiteter Activity-Feed kommen aus dem geteilten
  // Helper (dieselbe Quelle wie /affiliate/activity). Posts + Korrelation
  // bleiben hier. Activated bewusst NICHT angezeigt (nicht im Einfluss-
  // bereich des Affiliates), der Admin zeigt es weiterhin.
  const [act, postsRes] = await Promise.all([
    getAffiliateActivity(affiliateId),
    sb
      .from("affiliate_posts")
      .select("id, url, platform, posted_at, note, type")
      .eq("affiliate_id", affiliateId)
      .order("posted_at", { ascending: false }),
  ]);

  const { uniqueVisitors, signupCount, activity } = act;
  const posts = (postsRes.data ?? []) as PostRow[];
  const postStats = computePostStats(posts, act.allViews, act.allSignups);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://callday.io";
  const affiliateLink = `${baseUrl}/a/${aff.slug}`;

  return (
    <PortalShell
      current="dashboard"
      title="Dashboard"
      subtitle={`Your link: ${affiliateLink.replace(/^https?:\/\//, "")}`}
      actions={<CopyLinkButton link={affiliateLink} />}
    >
      {aff.status === "paused" ? (
        <WbNotice>
          Your account is paused. New sign-ups through your link won&apos;t be attributed
          until it&apos;s reactivated.
        </WbNotice>
      ) : null}

      <WbPanel
        title="Your link"
        subtitle="Share it anywhere: bio, captions, posts, DMs. Anyone who signs up through it counts toward your sign-ups."
        padded
      >
        <div className="wb-code-box" style={{ fontSize: 14 }}>{affiliateLink}</div>
      </WbPanel>

      <WbTileGrid>
        <WbStatTile label="Visitors" value={uniqueVisitors} sub="People who opened your link" />
        <WbStatTile label="Sign-ups" value={signupCount} sub="Created an account" />
      </WbTileGrid>

      <WbPanel
        title="Today's posts"
        subtitle={`Visitors and sign-ups in the ${POST_WINDOW_HOURS} h after each post`}
        meta={
          <span className="wb-inline">
            <Link href="/affiliate/posts" className="wb-link-blue">
              View all
            </Link>
            <PostComposer windowHours={POST_WINDOW_HOURS} />
          </span>
        }
      >
        <PostList posts={postStats} todayOnly />
      </WbPanel>

      <WbPanel
        title="Recent link activity"
        subtitle="Newest first"
        meta={
          <Link href="/affiliate/activity" className="wb-link-blue">
            View all
          </Link>
        }
      >
        <ActivityList activity={activity.slice(0, 5)} />
      </WbPanel>

      <p className="wb-note">
        Payouts go out about two weeks after public launch. The formal agreement follows
        separately by email.
      </p>
    </PortalShell>
  );
}
