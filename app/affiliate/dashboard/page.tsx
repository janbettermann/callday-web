import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CalldayLogo } from "../../components/CalldayLogo";
import {
  AFFILIATE_SESSION_COOKIE,
  verifyAffiliateSession,
} from "@/lib/affiliate-auth";
import { getServerSupabase } from "@/lib/supabase-server";

import { CopyLinkButton } from "./CopyLinkButton";
import { affiliateSignOutAction } from "./actions";

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

interface ActivityEvent {
  type: "view" | "signup";
  created_at: string;
  referrer_host?: string | null;
}

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
    .select("slug, name, status, founder_tier")
    .eq("id", affiliateId)
    .maybeSingle();

  if (!affiliate) {
    redirect("/affiliate/login");
  }

  const aff = affiliate as {
    slug: string;
    name: string;
    status: "active" | "paused" | "removed";
    founder_tier: boolean;
  };

  // Zwei Datenquellen parallel: Page-Views (Click-Tracking-Tabelle, unique
  // via visitor_hash distinct) + Signups (profiles.referred_by_affiliate_id).
  // Activated bewusst NICHT angezeigt — liegt nicht im Einflussbereich des
  // Affiliates (Produkt-Aktivierung), waere demotivierend ("5 sign-ups,
  // 0 activated"). Admin-Dashboard zeigt es weiterhin.
  const [uniqueRes, recentViewsRes, profilesRes] = await Promise.all([
    sb
      .from("affiliate_page_views")
      .select("visitor_hash")
      .eq("affiliate_id", affiliateId),
    sb
      .from("affiliate_page_views")
      .select("created_at, referrer_host")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false })
      .limit(50),
    sb
      .from("profiles")
      .select("id, created_at")
      .eq("referred_by_affiliate_id", affiliateId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const uniqueVisitors = new Set(
    ((uniqueRes.data ?? []) as Array<{ visitor_hash: string }>).map(
      (r) => r.visitor_hash,
    ),
  ).size;

  const profileRows = (profilesRes.data ?? []) as Array<{
    id: string;
    created_at: string;
  }>;

  const signupCount = profileRows.length;
  const signupRate =
    uniqueVisitors === 0
      ? "—"
      : `${Math.round((signupCount / uniqueVisitors) * 100)}%`;

  // Activity-Feed: View + Signup Events, chronologisch sortiert (neueste
  // zuerst), limited auf 50.
  const viewEvents: ActivityEvent[] = (
    (recentViewsRes.data ?? []) as Array<{
      created_at: string;
      referrer_host: string | null;
    }>
  ).map((v) => ({
    type: "view",
    created_at: v.created_at,
    referrer_host: v.referrer_host,
  }));
  const signupEvents: ActivityEvent[] = profileRows.map((p) => ({
    type: "signup",
    created_at: p.created_at,
  }));

  const activity: ActivityEvent[] = [...viewEvents, ...signupEvents]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://callday.io";
  const affiliateLink = `${baseUrl}/a/${aff.slug}`;
  const firstName = aff.name?.trim().split(/\s+/)[0] || "there";

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
        {/* === Header === */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div>
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
              {aff.founder_tier ? "Founding affiliate" : "Affiliate"}
            </div>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "-1px",
                lineHeight: 1.05,
                margin: 0,
                color: "var(--ink)",
              }}
            >
              Hi {firstName}.
            </h1>
          </div>
          <form action={affiliateSignOutAction}>
            <button
              type="submit"
              style={{
                background: "#ffffff",
                border: "0.5px solid var(--line)",
                color: "var(--ink-dim)",
                fontSize: 13,
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: 10,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
              }}
            >
              Sign out
            </button>
          </form>
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

          {activity.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: "var(--ink-dim)",
                fontSize: 14,
              }}
            >
              No activity yet. Share your link to get started.
            </p>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {activity.map((e, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "0.5px solid var(--line)",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--ink-dim)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <EventDot type={e.type} />
                    <span style={{ whiteSpace: "nowrap" }}>
                      {labelForEvent(e)}
                    </span>
                    {e.type === "view" && e.referrer_host ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--ink-faint)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        · {e.referrer_host}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--ink-faint)",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtRelative(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
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

function labelForEvent(e: ActivityEvent): string {
  return e.type === "signup" ? "Sign-up" : "View";
}

function EventDot({ type }: { type: ActivityEvent["type"] }) {
  const color =
    type === "signup"
      ? "var(--blue-deep, #2563e8)"
      : "var(--ink-faint, #94a3b8)";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 999,
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}
