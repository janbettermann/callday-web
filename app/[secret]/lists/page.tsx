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
import {
  WbAlert,
  WbBadge,
  WbEmpty,
  WbPanel,
  AdminShell,
  WbStatTile,
  WbTable,
  WbTd,
  WbTh,
  WbTileGrid,
  WbRow,
  type WbTone,
} from "../_components/admin-ui";

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

const STATUS_TONE: Record<LeadGenJobRow["status"], WbTone> = {
  ready: "green",
  failed: "red",
  pending: "amber",
  processing: "blue",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
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

  return (
    <AdminShell
      current="lists"
      basePath={`/${secret}`}
      title="Listen-Generator"
      subtitle="Jobs des Lead-Generators und Outscraper-Verbrauch der letzten 30 Tage"
    >
      {loadError ? (
        <WbAlert title="Daten konnten nicht geladen werden">
          <code>{loadError}</code>
        </WbAlert>
      ) : null}

      {stats ? (
        <WbTileGrid>
          <WbStatTile label="Jobs" value={stats.total} sub="Letzte 30 Tage" />
          <WbStatTile label="Ready" value={stats.ready} />
          <WbStatTile label="Failed" value={stats.failed} alert={stats.failed > 0} />
          <WbStatTile label="Leads geliefert" value={stats.deliveredLeads} />
          <WbStatTile
            label="Outscraper, grob"
            value={`$${stats.estimatedSpendUsd.toFixed(2)}`}
            sub="Records plus Domains, Medium-Tier"
          />
        </WbTileGrid>
      ) : null}

      <WbPanel title="Jobs" subtitle="Die letzten 50, neueste zuerst">
        {jobs.length === 0 ? (
          <WbEmpty>Noch keine Generator-Jobs.</WbEmpty>
        ) : (
          <WbTable>
            <thead>
              <tr>
                <WbTh>Zeit</WbTh>
                <WbTh>Nutzer</WbTh>
                <WbTh>Query</WbTh>
                <WbTh>Filter</WbTh>
                <WbTh>Status</WbTh>
                <WbTh align="right">Raw → Leads</WbTh>
                <WbTh>Fehler</WbTh>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <WbRow key={job.id} align="top">
                  <WbTd nowrap muted>{formatDate(job.created_at)}</WbTd>
                  <WbTd>{job.user_email ?? "–"}</WbTd>
                  <WbTd>
                    {job.query}
                    {job.params.tiles ? (
                      <div className="wb-sub">
                        {job.params.tiles.length} Tiles
                        {job.params.tile_limit ? ` à ${job.params.tile_limit}` : ""}
                        {(job.params.waves_done?.length ?? 0) > 1 || (job.params.wave ?? 1) > 1
                          ? `, ${Math.max(job.params.waves_done?.length ?? 0, job.params.wave ?? 1)} Wellen`
                          : ""}
                        {job.params.coverage
                          ? `, ${job.params.coverage.visited_before ?? job.params.coverage.covered_before}/${job.params.coverage.total} besucht`
                          : ""}
                        {job.params.enrich
                          ? `, Mails ${job.params.enrich.filled ?? "…"}/${job.params.enrich.domains}`
                          : ""}
                      </div>
                    ) : null}
                  </WbTd>
                  <WbTd nowrap muted>{websiteFilterLabel(job)}</WbTd>
                  <WbTd nowrap>
                    <WbBadge tone={STATUS_TONE[job.status]}>{job.status}</WbBadge>
                  </WbTd>
                  <WbTd align="right" nowrap>
                    <span className="wb-num">
                      {job.raw_count ?? "–"} → {job.lead_count ?? "–"}
                    </span>
                  </WbTd>
                  <WbTd wrap style={{ color: job.error ? "var(--wb-red)" : undefined, fontSize: 12 }}>
                    {job.error ?? ""}
                  </WbTd>
                </WbRow>
              ))}
            </tbody>
          </WbTable>
        )}
      </WbPanel>
    </AdminShell>
  );
}
