import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  getAdminPath,
  verifySession,
} from "@/lib/admin/auth";
import {
  DASHBOARD_RANGES,
  parseDashboardRange,
  type DashboardData,
  type DashboardRange,
} from "@/lib/admin/dashboard-metrics";
import { fetchDashboard } from "@/lib/admin/queries";

import { FeedbackTable } from "./_components/FeedbackTable";
import { FunnelStrip } from "./_components/FunnelStrip";
import { LoginForm } from "./_components/LoginForm";
import { UsersTable } from "./_components/UsersTable";
import {
  WbAlert,
  WbPanel,
  WbSegmented,
  AdminShell,
} from "./_components/admin-ui";

/**
 * /[secret] — Admin-Uebersicht nach dem Launch.
 *
 * Beantwortet drei Fragen eines Solo-Founders: Kommen Sign-ups?
 * Telefonieren die Leute danach? Zahlt jemand? Dazu eine Nutzerliste
 * fuer persoenliche Nachfass-Mails und das Feedback. Datenquelle ist
 * Supabase (profiles, call_outcomes, lead_lists, beta_feedback), die
 * Rechnung liegt getestet in lib/admin/dashboard-metrics.ts.
 *
 * Bewusst knapp gehalten (Jan, 2026-09-14, "zu viele Daten"): Funnel
 * als fuenf Kacheln, eine Nutzertabelle, Feedback. Sign-ups pro Woche,
 * Caller pro Tag, Abo-Block und Aktivierungs-Kacheln werden berechnet,
 * aber nicht gerendert, bis die Zahlen gross genug sind, dass sie etwas
 * erzaehlen.
 *
 * Interne Accounts (callday.io, Jans Adressen) sind per Blocklist immer
 * ausgeblendet, ohne Schalter. Zeitraum ueber `?range=`. Root-Layout
 * setzt `dynamic = "force-dynamic"`, jeder Request ist frisch.
 */

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string; range?: string }>;
};

const nf = new Intl.NumberFormat("de-DE");

function ratingMeta(data: DashboardData): string | null {
  if (data.ratings.count === 0 || data.ratings.average === null) return null;
  const avg = data.ratings.average.toFixed(1).replace(".", ",");
  const n = data.ratings.count;
  return `Sterne-Bewertungen: Ø ${avg} aus ${nf.format(n)} ${n === 1 ? "Rating" : "Ratings"}`;
}

function stamp(): string {
  return new Date().toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export default async function AdminPage({ params, searchParams }: PageProps) {
  const { secret } = await params;
  const { e: errFlag, range: rangeRaw } = await searchParams;

  const adminPath = getAdminPath();
  if (!adminPath || secret !== adminPath) {
    notFound();
  }

  const jar = await cookies();
  const authed = await verifySession(jar.get(ADMIN_SESSION_COOKIE)?.value);
  if (!authed) {
    return <LoginForm error={errFlag === "1"} />;
  }

  const rangeDays = parseDashboardRange(rangeRaw);
  const basePath = `/${secret}`;
  const href = (range: DashboardRange) =>
    range === 30 ? basePath : `${basePath}?range=${range}`;

  let data: DashboardData | null = null;
  let loadError: string | null = null;
  try {
    data = await fetchDashboard({ rangeDays, includeInternal: false });
  } catch (e) {
    console.error("[admin/dashboard]", e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <AdminShell
      current="dashboard"
      basePath={basePath}
      title="Übersicht"
      subtitle="Echte Nutzer, ohne Test- und Review-Accounts"
      actions={
        <>
          <WbSegmented
            items={DASHBOARD_RANGES.map((r) => ({
              key: String(r),
              label: `${r} Tage`,
              href: href(r),
              active: r === rangeDays,
            }))}
          />
          <span className="wb-stamp">Stand {stamp()}</span>
        </>
      }
    >
      {loadError ? (
        <WbAlert title="Daten konnten nicht geladen werden">
          <code>{loadError}</code>
        </WbAlert>
      ) : null}

      {data ? (
        <>
          <WbPanel
            title="Funnel"
            subtitle={`Letzte ${rangeDays} Tage gegen die ${rangeDays} Tage davor`}
            meta="Rechts: Stand jetzt"
          >
            <FunnelStrip kpis={data.kpis} />
          </WbPanel>

          <WbPanel
            title="Nutzer"
            subtitle={`${nf.format(data.users.length)} Accounts, nach letzter Aktivität`}
            meta="Stockt: über 7 Tage kein Call · Nie gecallt: mind. 2 Tage dabei, kein Call"
          >
            <UsersTable rows={data.users} rangeDays={rangeDays} />
          </WbPanel>

          <WbPanel title="Feedback" subtitle="Nur Einträge mit Text" meta={ratingMeta(data)}>
            <FeedbackTable rows={data.feedback} />
          </WbPanel>
        </>
      ) : null}
    </AdminShell>
  );
}
