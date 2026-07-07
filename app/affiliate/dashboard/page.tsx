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
import { AffiliateNav } from "../AffiliateNav";
import { AffiliateFooter } from "../AffiliateFooter";
import { affiliateMainStyle } from "../layout-styles";
import { ActivityList } from "../ActivityList";
import { PostList } from "../PostList";

import { CopyLinkButton } from "./CopyLinkButton";
import { AddPostForm } from "./AddPostForm";

/**
 * /affiliate/dashboard — Affiliate's eigene Mini-Page.
 *
 * Data-MVP (Plan-Phase 1.5):
 *   - Sein Affiliate-Link mit Copy-Button
 *   - Sign-ups Count + Activated Count
 *   - Recent-Activity-Timestamps (kein PII)
 *   - Hint zu Payouts (post-launch)
 *
 * Auth: Cookie-Gate via verifyAffiliateSession. Removed-Status fliegt
 * im verify schon raus → redirect zu /login mit Error. Paused-Affiliates
 * sehen ein Hinweis-Banner aber haben Zugriff.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your dashboard · Callday Affiliates",
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
  // Helper (dieselbe Quelle wie /affiliate/activity, kein Copy-Paste). Posts +
  // Korrelation bleiben hier. Activated bewusst NICHT angezeigt (nicht im
  // Einflussbereich des Affiliates) — Admin-Dashboard zeigt es weiterhin.
  const [act, postsRes] = await Promise.all([
    getAffiliateActivity(affiliateId),
    sb
      .from("affiliate_posts")
      .select("id, url, platform, posted_at, note")
      .eq("affiliate_id", affiliateId)
      .order("posted_at", { ascending: false }),
  ]);

  const { uniqueVisitors, signupCount, signupRate, activity } = act;
  const posts = (postsRes.data ?? []) as PostRow[];
  const postStats = computePostStats(posts, act.allViews, act.allSignups);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://callday.io";
  const affiliateLink = `${baseUrl}/a/${aff.slug}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AffiliateNav />

      <main className="container" style={affiliateMainStyle}>
        {/* === Header === */}
        <header style={{ marginBottom: 20 }}>
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
            Dashboard
          </h1>
        </header>

        {aff.status === "paused" ? (
          <div
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "0.5px solid rgba(245,158,11,0.3)",
              borderRadius: 16,
              padding: "14px 18px",
              marginBottom: 32,
              color: "var(--sun-deep)",
              fontSize: 14,
            }}
          >
            Your account is paused. New sign-ups through your link
            won&apos;t be attributed until it&apos;s reactivated.
          </div>
        ) : null}

        {/* === Affiliate-Link === */}
        <section
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 24,
            padding: 28,
            marginBottom: 24,
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "var(--ink-faint)",
              marginBottom: 10,
            }}
          >
            Your link
          </div>
          <div
            style={{
              background: "rgba(26,29,38,0.045)",
              borderRadius: 12,
              padding: "14px 16px",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 15,
              color: "var(--ink)",
              wordBreak: "break-all",
              marginBottom: 14,
            }}
          >
            {affiliateLink}
          </div>
          <CopyLinkButton link={affiliateLink} />
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              color: "var(--ink-dim)",
              lineHeight: 1.5,
            }}
          >
            Share this anywhere — bio, captions, posts, DMs. Anyone who signs
            up through it counts toward your sign-ups below.
          </p>
        </section>

        {/* === Stats === */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard
            label="Visitors"
            value={uniqueVisitors}
            hint="People who opened your link"
          />
          <StatCard
            label="Sign-ups"
            value={signupCount}
            hint="Created an account"
          />
          <StatCard
            label="Sign-up rate"
            value={signupRate}
            hint="Sign-ups / Visitors"
          />
        </section>

        {/* === Recent activity === */}
        <section
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 24,
            padding: 28,
            marginBottom: 24,
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "var(--ink-faint)",
              marginBottom: 14,
            }}
          >
            Recent activity
          </div>

          <ActivityList activity={activity.slice(0, 10)} />
          {activity.length > 0 ? (
            <Link
              href="/affiliate/activity"
              style={{
                display: "inline-block",
                marginTop: 16,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--blue-deep, #2563e8)",
                textDecoration: "none",
              }}
            >
              View all activity →
            </Link>
          ) : null}
        </section>

        {/* === Posts === */}
        <section
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 24,
            padding: 28,
            marginBottom: 24,
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "var(--ink-faint)",
              marginBottom: 8,
            }}
          >
            Posts
          </div>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: "var(--ink-dim)",
              lineHeight: 1.5,
            }}
          >
            Log a post to see how many visitors and sign-ups came in the{" "}
            {POST_WINDOW_HOURS} h after it. Today&apos;s posts show here — your
            full log lives under Posts.
          </p>

          <AddPostForm />

          <div style={{ marginTop: 24 }}>
            <PostList posts={postStats} todayOnly />
          </div>
          {postStats.length > 0 ? (
            <Link
              href="/affiliate/posts"
              style={{
                display: "inline-block",
                marginTop: 16,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--blue-deep, #2563e8)",
                textDecoration: "none",
              }}
            >
              View all posts →
            </Link>
          ) : null}
        </section>

        {/* === Payouts hint === */}
        <p
          style={{
            margin: 0,
            color: "var(--ink-faint)",
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: "center",
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Payouts go out ~2 weeks after public launch. The formal agreement
          follows separately by email — keep an eye on your inbox.
        </p>
      </main>

      <AffiliateFooter />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
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
          fontFamily: "var(--font-mono), monospace",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 30,
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
