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
import {
  WbAlert,
  WbPanel,
  WbSegmented,
  AdminShell,
  WbStatTile,
  WbTileGrid,
} from "../_components/admin-ui";
import { CreateAffiliateForm } from "./_components/CreateAffiliateForm";
import { AffiliateTable } from "./_components/AffiliateTable";

/**
 * /[secret]/affiliates — Admin-Affiliate-Management.
 *
 * Werkbank-Design durchgaengig: Kacheln, Formular-Panel, Cohort-Panel mit
 * Status-Schalter im Kopf und Suchzeile in der Tabelle, Detail-Drawer.
 *
 * Auth + Composition wie /[secret]/page.tsx.
 */

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string; status?: string; q?: string }>;
};

type StatusFilterValue = "all" | AffiliateStatus;

const STATUS_FILTERS: Array<{ key: StatusFilterValue; label: string }> = [
  { key: "all", label: "Alle" },
  { key: "active", label: "Aktiv" },
  { key: "paused", label: "Pausiert" },
  { key: "removed", label: "Entfernt" },
];

function parseStatusFilter(raw: string | undefined): StatusFilterValue {
  return STATUS_FILTERS.some((f) => f.key === raw) ? (raw as StatusFilterValue) : "all";
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
  const basePath = `/${secret}`;
  const pagePath = `${basePath}/affiliates`;

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
  // Auszahlbare Provisionen über alle Affiliates (USD-Ledger, siehe
  // specs/affiliate-currency.md). Summierbar, weil commission_cents kanonisch
  // USD ist.
  const totalPayableCents = affiliates.reduce(
    (sum, a) => sum + a.available_cents,
    0,
  );
  const totalPayable = new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
  }).format(totalPayableCents / 100);

  return (
    <AdminShell
      current="affiliates"
      basePath={basePath}
      title="Affiliates"
      subtitle="Cohort onboarden, Status pflegen, Welcome-Mails senden. Slugs sind permanent."
    >
      <WbTileGrid>
        <WbStatTile label="Affiliates" value={affiliates.length} />
        <WbStatTile label="Sign-ups" value={totalSignups} />
        <WbStatTile label="Aktiviert" value={totalActivated} />
        <WbStatTile
          label="Conversion"
          value={
            totalSignups === 0
              ? "–"
              : `${Math.round((totalActivated / totalSignups) * 100)} %`
          }
          sub="Aktiviert von Sign-ups"
        />
        <WbStatTile label="Auszahlbar" value={totalPayable} sub="USD-Ledger" />
      </WbTileGrid>

      {loadError ? (
        <WbAlert title="Affiliates konnten nicht geladen werden">
          <code>{loadError}</code>
        </WbAlert>
      ) : null}

      <WbPanel title="Neuer Affiliate" subtitle="Slug ist danach fest, er steht in Verträgen" padded>
        <CreateAffiliateForm />
      </WbPanel>

      <WbPanel
        title="Cohort"
        subtitle="Klick auf eine Zeile öffnet die Details"
        meta={
          <WbSegmented
            items={STATUS_FILTERS.map((f) => ({
              key: f.key,
              label: f.label,
              href: f.key === "all" ? pagePath : `${pagePath}?status=${f.key}`,
              active: f.key === statusFilter,
              count: counts[f.key],
            }))}
          />
        }
      >
        <AffiliateTable rows={filtered} search={search} />
      </WbPanel>
    </AdminShell>
  );
}
