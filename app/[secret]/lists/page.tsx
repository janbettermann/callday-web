import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  getAdminPath,
  verifySession,
} from "@/lib/admin/auth";
import {
  fetchLeadGenJobs,
  fetchLeadGenStats,
  type LeadGenJobRow,
  type LeadGenStats,
} from "@/lib/admin/lists-queries";

import { LoginForm } from "../_components/LoginForm";
import { AdminNav } from "../_components/admin-ui";
import { logoutAction } from "../actions";

/**
 * /[secret]/lists — Observability fuer den Listen-Generator.
 *
 * Minimalform vor der ersten bezahlten Kampagne: failed Jobs sichtbar
 * machen (lagen bisher unsichtbar in lead_gen_jobs) + Outscraper-
 * Verbrauch der letzten 30 Tage beziffern. Auth + Composition wie
 * /[secret]/page.tsx.
 */

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string }>;
};

const STATUS_COLORS: Record<LeadGenJobRow["status"], { bg: string; fg: string }> = {
  ready: { bg: "rgba(16, 185, 129, 0.1)", fg: "#047857" },
  failed: { bg: "rgba(220, 38, 38, 0.1)", fg: "#b91c1c" },
  pending: { bg: "rgba(245, 158, 11, 0.12)", fg: "#92400e" },
  processing: { bg: "rgba(74, 122, 247, 0.1)", fg: "var(--blue-deep)" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function websiteFilterLabel(job: LeadGenJobRow): string {
  if (job.params.website === "without") return "ohne Website";
  if (job.params.website === "with") return "mit Website";
  return "";
}

export default async function ListsAdminPage({ params, searchParams }: PageProps) {
  const { secret } = await params;
  const { e: errFlag } = await searchParams;

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

  let jobs: LeadGenJobRow[] = [];
  let stats: LeadGenStats | null = null;
  let loadError: string | null = null;
  try {
    [jobs, stats] = await Promise.all([
      fetchLeadGenJobs(50),
      fetchLeadGenStats(30),
    ]);
  } catch (e) {
    console.error("[admin/lists]", e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  const statCards = stats
    ? [
        { label: "Jobs (30 Tage)", value: String(stats.total) },
        { label: "Ready", value: String(stats.ready) },
        {
          label: "Failed",
          value: String(stats.failed),
          alert: stats.failed > 0,
        },
        { label: "Leads geliefert", value: String(stats.deliveredLeads) },
        {
          label: "Outscraper ~Spend",
          value: `$${stats.estimatedSpendUsd.toFixed(2)}`,
        },
      ]
    : [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <header style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            <AdminNav current="lists" basePath={`/${secret}`} />
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
          </div>
          <h1
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.5px",
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Listen-Generator
          </h1>
        </header>

        {loadError && (
          <p className="beta-submit-error" role="alert">
            {loadError}
          </p>
        )}

        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
              marginBottom: 36,
            }}
          >
            {statCards.map((card) => (
              <div
                key={card.label}
                style={{
                  background: "#ffffff",
                  border: card.alert
                    ? "1px solid rgba(220, 38, 38, 0.4)"
                    : "0.5px solid var(--line)",
                  borderRadius: 14,
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-faint)",
                    marginBottom: 6,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    letterSpacing: "-0.5px",
                    color: card.alert ? "#b91c1c" : "var(--ink)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--line)" }}>
                {["Zeit", "User", "Query", "Filter", "Status", "Raw → Leads", "Fehler"].map(
                  (label) => (
                    <th
                      key={label}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "var(--ink-faint)",
                      }}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "24px 14px",
                      color: "var(--ink-faint)",
                      textAlign: "center",
                    }}
                  >
                    Noch keine Generator-Jobs.
                  </td>
                </tr>
              )}
              {jobs.map((job) => {
                const color = STATUS_COLORS[job.status];
                return (
                  <tr
                    key={job.id}
                    className="admin-row"
                    style={{ borderBottom: "0.5px solid var(--line)" }}
                  >
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "var(--ink-dim)" }}>
                      {formatDate(job.created_at)}
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--ink)" }}>
                      {job.user_email ?? "—"}
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--ink)" }}>
                      {job.query}
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--ink-dim)" }}>
                      {websiteFilterLabel(job)}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span
                        style={{
                          background: color.bg,
                          color: color.fg,
                          fontSize: 12,
                          fontWeight: 500,
                          padding: "3px 10px",
                          borderRadius: 999,
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        color: "var(--ink-dim)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.raw_count ?? "–"} → {job.lead_count ?? "–"}
                    </td>
                    <td style={{ padding: "11px 14px", color: "#b91c1c", fontSize: 12 }}>
                      {job.error ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
