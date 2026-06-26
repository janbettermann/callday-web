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

interface RecentSignup {
  created_at: string;
  has_list: boolean;
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

  // Signups + Activated + Recent-Activity laden.
  // Wir holen profiles + lead_lists in zwei Pässen statt Postgrest-Join
  // weil die Beziehung nicht im Schema-Cache stehen muss.
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, created_at")
    .eq("referred_by_affiliate_id", affiliateId)
    .order("created_at", { ascending: false })
    .limit(50);

  const profileRows = (profiles ?? []) as Array<{
    id: string;
    created_at: string;
  }>;
  const profileIds = profileRows.map((p) => p.id);

  let activatedSet = new Set<string>();
  if (profileIds.length > 0) {
    const { data: lists } = await sb
      .from("lead_lists")
      .select("user_id")
      .in("user_id", profileIds);
    activatedSet = new Set(
      (lists ?? []).map((l) => (l as { user_id: string }).user_id),
    );
  }

  const signupCount = profileRows.length;
  const activatedCount = activatedSet.size;
  const conversionRate =
    signupCount === 0
      ? "—"
      : `${Math.round((activatedCount / signupCount) * 100)}%`;

  const recent: RecentSignup[] = profileRows.slice(0, 10).map((p) => ({
    created_at: p.created_at,
    has_list: activatedSet.has(p.id),
  }));

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
          <StatCard label="Sign-ups" value={signupCount} hint="Created an account" />
          <StatCard
            label="Activated"
            value={activatedCount}
            hint="Uploaded their first list"
          />
          <StatCard label="Conversion" value={conversionRate} hint="Activated / Sign-ups" />
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

          {recent.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: "var(--ink-dim)",
                fontSize: 14,
              }}
            >
              No sign-ups yet. Share your link to get started.
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
              {recent.map((r, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "0.5px solid var(--line)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--ink-dim)",
                    }}
                  >
                    {r.has_list ? "Activated" : "New sign-up"}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--ink-faint)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtRelative(r.created_at)}
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
