import type { Metadata } from "next";
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
import { WbPanel } from "@/app/components/werkbank";

import { PortalShell } from "../PortalShell";
import { PostList } from "../PostList";
import { PostComposer } from "../dashboard/PostComposer";

/**
 * /affiliate/posts: alle je geloggten Posts (mit Korrelation). Das
 * Dashboard zeigt nur die heutigen; hier ist das Archiv. Gleiche Datenlogik
 * (getAffiliateActivity + computePostStats) und dieselbe PostList.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Posts · Callday Affiliates",
  robots: { index: false, follow: false },
};

export default async function AffiliatePostsPage() {
  const jar = await cookies();
  const affiliateId = await verifyAffiliateSession(
    jar.get(AFFILIATE_SESSION_COOKIE)?.value,
  );

  if (!affiliateId) {
    redirect("/affiliate/login");
  }

  const sb = getServerSupabase();
  const [act, postsRes] = await Promise.all([
    getAffiliateActivity(affiliateId),
    sb
      .from("affiliate_posts")
      .select("id, url, platform, posted_at, note, type")
      .eq("affiliate_id", affiliateId)
      .order("posted_at", { ascending: false }),
  ]);

  const posts = (postsRes.data ?? []) as PostRow[];
  const postStats = computePostStats(posts, act.allViews, act.allSignups);

  return (
    <PortalShell
      current="posts"
      title="Posts"
      subtitle="Every post you've logged and how it moved your numbers"
      actions={<PostComposer windowHours={POST_WINDOW_HOURS} />}
    >
      <WbPanel
        title="All posts"
        subtitle={`Visitors and sign-ups in the ${POST_WINDOW_HOURS} h after each post, newest first`}
      >
        <PostList posts={postStats} />
      </WbPanel>
    </PortalShell>
  );
}
