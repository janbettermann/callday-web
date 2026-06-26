import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  getAdminPath,
  verifySession,
} from "@/lib/admin/auth";
import { fetchAffiliates } from "@/lib/admin/affiliate-queries";
import type {
  AffiliateRow,
  AffiliateStatus,
} from "@/lib/admin/affiliate-queries";

import { LoginForm } from "../_components/LoginForm";
import { logoutAction } from "../actions";
import { CreateAffiliateForm } from "./_components/CreateAffiliateForm";
import { AffiliateTable } from "./_components/AffiliateTable";
import {
  StatusFilter,
  type StatusFilterValue,
} from "./_components/StatusFilter";

/**
 * /[secret]/affiliates — Admin-Affiliate-Management, on-brand.
 *
 * Design folgt der Marketing-Landing: cream bg, italic-Akzent auf
 * Headline, form-card-Style fuer Create-Section, soft shadows.
 *
 * Auth + Composition wie /[secret]/page.tsx.
 */

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string; status?: string; q?: string }>;
};

const VALID_STATUSES: StatusFilterValue[] = [
  "all",
  "active",
  "paused",
  "removed",
];

function parseStatusFilter(raw: string | undefined): StatusFilterValue {
  if (raw && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as StatusFilterValue;
  }
  return "all";
}

export default async function AffiliatesAdminPage({
  params,
  searchParams,
}: PageProps) {
  const { secret } = await params;
  const { e: errFlag, status: statusRaw, q: searchRaw } = await searchParams;

  const adminPath = getAdminPath();
  if (!adminPath || secret !== adminPath) {
    notFound();
  }

  const jar = await cookies();
  const sessionCookie = jar.get(ADMIN_SESSION_COOKIE)?.value;
  const authed = await verifySession(sessionCookie);

  if (!authed) {
    return <LoginForm error={errFlag === "1"} />;
  }

  const statusFilter = parseStatusFilter(statusRaw);
  const search = searchRaw ?? "";
  const basePath = `/${secret}/affiliates`;

  let affiliates: AffiliateRow[] = [];
  let loadError: string | null = null;
  try {
    affiliates = await fetchAffiliates();
  } catch (e) {
    console.error("[admin/affiliates]", e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  const counts: Record<StatusFilterValue, number> = {
    all: affiliates.length,
    active: affiliates.filter((a) => a.status === "active").length,
    paused: affiliates.filter((a) => a.status === "paused").length,
    removed: affiliates.filter((a) => a.status === "removed").length,
  };

  const filtered =
    statusFilter === "all"
      ? affiliates
      : affiliates.filter((a) => a.status === (statusFilter as AffiliateStatus));

  const totalSignups = affiliates.reduce((sum, a) => sum + a.signup_count, 0);
  const totalActivated = affiliates.reduce(
    (sum, a) => sum + a.activated_count,
    0,
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div
        className="container"
        style={{ paddingTop: 48, paddingBottom: 80 }}
      >
        {/* === HEADER === */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            marginBottom: 48,
          }}
        >
          <div>
            <Link
              href={`/${secret}`}
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                textDecoration: "none",
              }}
            >
              ← Internal dashboard
            </Link>
            <h1
              style={{
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: "-1.2px",
                lineHeight: 1.05,
                margin: "10px 0 0",
                color: "var(--ink)",
              }}
            >
              Founding{" "}
              <span className="italic" style={{ color: "var(--blue-deep)" }}>
                affiliates.
              </span>
            </h1>
            <p
              style={{
                marginTop: 10,
                color: "var(--ink-dim)",
                fontSize: 15,
                lineHeight: 1.5,
                maxWidth: 540,
              }}
            >
              Onboard the cohort, manage status, send welcome mails. Slugs
              are permanent — bake them into contracts.
            </p>
          </div>

          <form action={logoutAction}>
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

        {/* === TOP-LEVEL STATS === */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <StatCard label="Affiliates" value={affiliates.length} />
          <StatCard label="Sign-ups" value={totalSignups} />
          <StatCard label="Activated" value={totalActivated} />
          <StatCard
            label="CR"
            value={
              totalSignups === 0
                ? "—"
                : `${Math.round((totalActivated / totalSignups) * 100)}%`
            }
          />
        </div>

        {loadError ? (
          <div
            style={{
              border: "0.5px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.04)",
              borderRadius: 16,
              padding: 18,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "#b91c1c",
                marginBottom: 4,
              }}
            >
              Failed to load affiliates
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                color: "var(--ink-dim)",
              }}
            >
              {loadError}
            </div>
          </div>
        ) : null}

        {/* === CREATE FORM === */}
        <section style={{ marginBottom: 48 }}>
          <SectionLabel>New affiliate</SectionLabel>
          <CreateAffiliateForm />
        </section>

        {/* === LISTE === */}
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <SectionLabel>Cohort</SectionLabel>
            <StatusFilter
              current={statusFilter}
              counts={counts}
              basePath={basePath}
            />
          </div>

          <AffiliateTable rows={filtered} search={search} />
        </section>

        <footer
          style={{
            marginTop: 80,
            paddingTop: 24,
            borderTop: "0.5px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "var(--ink-faint)",
          }}
        >
          <span>Refresh for latest</span>
          <span>Callday · internal</span>
        </footer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 16,
        padding: "16px 18px",
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
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.6px",
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "var(--ink-faint)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
