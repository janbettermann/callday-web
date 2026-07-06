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
  type PostRow,
} from "@/lib/affiliate-activity";
import { AffiliateNav } from "../AffiliateNav";
import { AffiliateFooter } from "../AffiliateFooter";
import { PostList } from "../PostList";

/**
 * /affiliate/posts — alle je geloggten Posts (mit Korrelation). Das Dashboard
 * zeigt nur die heutigen; hier ist das Archiv. Gleiche Datenlogik
 * (getAffiliateActivity + computePostStats) und dieselbe PostList-Komponente.
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
      .select("id, url, platform, posted_at, note")
      .eq("affiliate_id", affiliateId)
      .order("posted_at", { ascending: false }),
  ]);

  const posts = (postsRes.data ?? []) as PostRow[];
  const postStats = computePostStats(posts, act.allViews, act.allSignups);

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
          All posts
        </h1>
        <p
          style={{ margin: "0 0 32px", fontSize: 14, color: "var(--ink-dim)" }}
        >
          Every post you&apos;ve logged and how it moved your numbers.
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
          <PostList posts={postStats} />
        </section>
      </main>

      <AffiliateFooter />
    </div>
  );
}
