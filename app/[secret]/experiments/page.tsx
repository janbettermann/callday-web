import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  getAdminPath,
  verifySession,
} from "@/lib/admin/auth";
import {
  DEVICE_ORDER,
  activeExperimentReport,
  byDevice,
  bySource,
  dailySeries,
  fetchLpEvents,
  recentSignups,
  totals,
  type ExperimentReport,
  type FunnelCounts,
  type LpEventRow,
  type RecentSignupRow,
} from "@/lib/admin/lp-queries";
import { ACTIVE_EXPERIMENT } from "@/lib/lp/experiments";
import type { LpPage, LpSource } from "@/lib/lp/shared";

import { LoginForm } from "../_components/LoginForm";
import {
  WbAlert,
  WbBadge,
  WbEmpty,
  WbMetricStrip,
  WbNotice,
  WbNumeric,
  WbPanel,
  WbSegmented,
  AdminShell,
  WbTable,
  WbTd,
  WbTh,
  WbRow,
} from "../_components/admin-ui";

/**
 * /[secret]/experiments — Landing-Funnel + Split-Test-Auswertung.
 *
 * Datenquelle ist lp_events (lib/lp, Migration 0058 im App-Repo). Oben
 * der Funnel ueber alle Besucher (Baseline: was bringen die Ads?), nach
 * Quelle und Geraet; darunter das aktive Experiment mit Varianten-
 * Vergleich, Stichproben-Fortschritt und Signifikanz. Auth + Composition
 * wie /[secret]/page.tsx.
 */

type PageProps = {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ e?: string; range?: string; page?: string }>;
};

type RangeKey = "7" | "14" | "30" | "all";
const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "7", label: "7 Tage" },
  { key: "14", label: "14 Tage" },
  { key: "30", label: "30 Tage" },
  { key: "all", label: "Alles" },
];
const SOURCE_LABELS: Record<LpSource, string> = {
  meta: "Meta Ads",
  google: "Google",
  direct: "Direkt",
  other: "Andere",
};

function parseRange(raw: string | undefined): RangeKey {
  return raw === "7" || raw === "30" || raw === "all" ? raw : "14";
}
function parsePage(raw: string | undefined): LpPage {
  return raw === "affiliate" ? "affiliate" : "landing";
}
function sinceForRange(range: RangeKey): string | null {
  if (range === "all") return null;
  return new Date(Date.now() - Number(range) * 86_400_000).toISOString();
}

const nf = new Intl.NumberFormat("de-DE");
function num(n: number): string {
  return nf.format(n);
}
function pct(part: number, whole: number, digits = 1): string {
  if (whole <= 0) return "–";
  return `${((part / whole) * 100).toFixed(digits).replace(".", ",")} %`;
}
function fmtLift(lift: number | null): string {
  if (lift === null || !Number.isFinite(lift)) return "–";
  const sign = lift >= 0 ? "+" : "";
  return `${sign}${(lift * 100).toFixed(1).replace(".", ",")} %`;
}
function fmtProb(p: number | null): string {
  if (p === null) return "–";
  return `${(p * 100).toFixed(0)} %`;
}
function fmtP(p: number | null): string {
  if (p === null) return "–";
  return p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ",");
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export default async function ExperimentsAdminPage({ params, searchParams }: PageProps) {
  const { secret } = await params;
  const { e: errFlag, range: rangeRaw, page: pageRaw } = await searchParams;

  const adminPath = getAdminPath();
  if (!adminPath || secret !== adminPath) {
    notFound();
  }

  const jar = await cookies();
  const authed = await verifySession(jar.get(ADMIN_SESSION_COOKIE)?.value);
  if (!authed) {
    return <LoginForm error={errFlag === "1"} />;
  }

  const range = parseRange(rangeRaw);
  const page = parsePage(pageRaw);
  const rangeSince = sinceForRange(range);

  // Fuer den Experiment-Report brauchen wir alle Rows seit Teststart,
  // unabhaengig vom Funnel-Zeitraum — also das fruehere der beiden Daten
  // laden und den Funnel danach in JS auf den Zeitraum filtern.
  const experimentSince = ACTIVE_EXPERIMENT
    ? new Date(`${ACTIVE_EXPERIMENT.startedAt}T00:00:00Z`).toISOString()
    : null;
  const fetchSince =
    rangeSince === null || experimentSince === null
      ? rangeSince === null
        ? null
        : experimentSince === null
          ? rangeSince
          : null
      : rangeSince < experimentSince
        ? rangeSince
        : experimentSince;

  let rows: LpEventRow[] = [];
  let tableMissing = false;
  let loadError: string | null = null;
  try {
    const res = await fetchLpEvents({ sinceIso: fetchSince, page });
    rows = res.rows;
    tableMissing = res.tableMissing;
  } catch (e) {
    console.error("[admin/experiments]", e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  const funnelRows = rangeSince
    ? rows.filter((r) => r.created_at >= rangeSince)
    : rows;
  const total = totals(funnelRows);
  const sources = bySource(funnelRows);
  const devices = byDevice(funnelRows);
  const daily = dailySeries(funnelRows, range === "all" ? 30 : Number(range));
  const report = page === "landing" ? activeExperimentReport(rows) : null;
  const signups = await recentSignups(funnelRows, 20);

  const basePath = `/${secret}`;
  const tabHref = (r: RangeKey, p: LpPage) =>
    `${basePath}/experiments?range=${r}&page=${p}`;

  return (
    <AdminShell
      current="experiments"
      basePath={basePath}
      title="Landing-Experimente"
      subtitle="Besucher, CTA-Klicks und Sign-ups der Landing Page, cookielos aus lp_events"
      actions={
        <>
          <WbSegmented
            items={[
              { key: "landing", label: "Landing", href: tabHref(range, "landing"), active: page === "landing" },
              { key: "affiliate", label: "Affiliate-Landings", href: tabHref(range, "affiliate"), active: page === "affiliate" },
            ]}
          />
          <WbSegmented
            items={RANGES.map((r) => ({
              key: r.key,
              label: r.label,
              href: tabHref(r.key, page),
              active: r.key === range,
            }))}
          />
        </>
      }
    >
      {loadError ? (
        <WbAlert title="Daten konnten nicht geladen werden">
          <code>{loadError}</code>
        </WbAlert>
      ) : null}

      {tableMissing ? (
        <WbNotice>
          Die Tabelle <code>lp_events</code> existiert noch nicht. Migration
          <code> 0058_lp_events.sql</code> im App-Repo anwenden (siehe
          docs/experiments.md), danach laufen die Zahlen hier auf.
        </WbNotice>
      ) : null}

      <WbPanel
        title="Funnel"
        subtitle={`Alle Besucher der ${page === "landing" ? "Landing" : "Affiliate-Landings"} im Zeitraum`}
        meta="Ein Besucher zählt pro Schritt höchstens einmal"
      >
        <WbMetricStrip
          items={[
            { key: "visitors", label: "Besucher", value: num(total.visitors), sub: "Distinct, mit JS geladen" },
            { key: "cta", label: "CTA geklickt", value: num(total.ctaClickers), sub: `${pct(total.ctaClickers, total.visitors)} der Besucher` },
            { key: "started", label: "Sign-up gestartet", value: num(total.starters), sub: `${pct(total.starters, total.visitors)} der Besucher` },
            { key: "confirmed", label: "Bestätigt", value: num(total.confirmed), sub: `${pct(total.confirmed, total.visitors, 2)} der Besucher` },
          ]}
        />
      </WbPanel>

      {page === "landing" ? (
        <WbPanel
          title="Aktives Experiment"
          subtitle={
            report
              ? `${report.experiment.name} · seit ${report.experiment.startedAt} (${report.daysRunning} Tage)`
              : "Kein Test aktiv, die Seite läuft als Default, der Funnel oben ist die Baseline"
          }
        >
          {report ? (
            <ExperimentPanel report={report} />
          ) : (
            <WbEmpty>
              Einen Test starten: in <code>lib/lp/experiments.ts</code> das Objekt{" "}
              <code>ACTIVE_EXPERIMENT</code> befüllen, die Variante in <code>app/page.tsx</code>{" "}
              verzweigen, deployen. Ab dann zählt jeder Besucher für eine Variante.
            </WbEmpty>
          )}
        </WbPanel>
      ) : null}

      <WbPanel title="Nach Quelle" subtitle="UTM schlägt Referrer; fbclid ohne UTM zählt als Meta">
        <FunnelTable
          rows={sources.map((s) => ({ key: s.key, label: SOURCE_LABELS[s.key], counts: s.counts }))}
        />
      </WbPanel>

      <WbPanel title="Nach Gerät" subtitle="Meta-Traffic landet fast komplett im Instagram- und Facebook-In-App-Browser">
        <FunnelTable
          rows={devices.map((d) => ({
            key: d.key,
            label: DEVICE_ORDER.find((x) => x.key === d.key)?.label ?? d.key,
            counts: d.counts,
          }))}
        />
      </WbPanel>

      <WbPanel title="Pro Tag" subtitle="UTC-Tage, Lücken sind Tage ohne Besucher">
        <DailyTable rows={daily} />
      </WbPanel>

      <WbPanel title="Letzte Sign-ups" subtitle="Bestätigte Accounts mit Herkunft, neueste zuerst">
        <SignupsTable rows={signups} />
      </WbPanel>
    </AdminShell>
  );
}

// ----------------------------------------------------------------
// Bausteine
// ----------------------------------------------------------------

function FunnelTable({
  rows,
}: {
  rows: Array<{ key: string; label: string; counts: FunnelCounts }>;
}) {
  return (
    <WbTable>
      <thead>
        <tr>
          <WbTh>Segment</WbTh>
          <WbTh align="right">Besucher</WbTh>
          <WbTh align="right">CTA</WbTh>
          <WbTh align="right">Gestartet</WbTh>
          <WbTh align="right">Bestätigt</WbTh>
          <WbTh align="right">Start-Rate</WbTh>
          <WbTh align="right">Confirm-Rate</WbTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <WbRow key={r.key}>
            <WbTd nowrap style={{ fontWeight: 500 }}>
              {r.label}
            </WbTd>
            <WbTd align="right"><WbNumeric value={num(r.counts.visitors)} bold /></WbTd>
            <WbTd align="right"><WbNumeric value={num(r.counts.ctaClickers)} /></WbTd>
            <WbTd align="right"><WbNumeric value={num(r.counts.starters)} /></WbTd>
            <WbTd align="right"><WbNumeric value={num(r.counts.confirmed)} /></WbTd>
            <WbTd align="right"><WbNumeric value={pct(r.counts.starters, r.counts.visitors)} /></WbTd>
            <WbTd align="right"><WbNumeric value={pct(r.counts.confirmed, r.counts.visitors, 2)} /></WbTd>
          </WbRow>
        ))}
      </tbody>
    </WbTable>
  );
}

function DailyTable({ rows }: { rows: Array<{ date: string; counts: FunnelCounts }> }) {
  const hasAny = rows.some((r) => r.counts.visitors > 0);
  if (!hasAny) {
    return <WbEmpty>Noch keine Besucher im Zeitraum.</WbEmpty>;
  }
  return (
    <WbTable>
      <thead>
        <tr>
          <WbTh>Tag</WbTh>
          <WbTh align="right">Besucher</WbTh>
          <WbTh align="right">CTA</WbTh>
          <WbTh align="right">Gestartet</WbTh>
          <WbTh align="right">Bestätigt</WbTh>
        </tr>
      </thead>
      <tbody>
        {rows
          .slice()
          .reverse()
          .map((r) => (
            <WbRow key={r.date}>
              <WbTd mono nowrap>{r.date}</WbTd>
              <WbTd align="right"><WbNumeric value={num(r.counts.visitors)} bold /></WbTd>
              <WbTd align="right"><WbNumeric value={num(r.counts.ctaClickers)} /></WbTd>
              <WbTd align="right"><WbNumeric value={num(r.counts.starters)} /></WbTd>
              <WbTd align="right"><WbNumeric value={num(r.counts.confirmed)} /></WbTd>
            </WbRow>
          ))}
      </tbody>
    </WbTable>
  );
}

function SignupsTable({ rows }: { rows: RecentSignupRow[] }) {
  if (rows.length === 0) {
    return <WbEmpty>Noch kein bestätigter Sign-up über die Landing im Zeitraum.</WbEmpty>;
  }
  return (
    <WbTable>
      <thead>
        <tr>
          <WbTh>Zeit</WbTh>
          <WbTh>E-Mail</WbTh>
          <WbTh>Quelle</WbTh>
          <WbTh>Kampagne / Anzeige</WbTh>
          <WbTh>Variante</WbTh>
          <WbTh>Gerät</WbTh>
          <WbTh>Land</WbTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <WbRow key={`${r.created_at}-${i}`}>
            <WbTd nowrap muted>{formatDateTime(r.created_at)}</WbTd>
            <WbTd>{r.email ?? "–"}</WbTd>
            <WbTd nowrap>{SOURCE_LABELS[r.source]}</WbTd>
            <WbTd muted>
              {[r.utm_campaign, r.utm_content].filter(Boolean).join(" / ") || "–"}
            </WbTd>
            <WbTd mono nowrap>
              {r.experiment_key ? `${r.experiment_key} · ${r.variant ?? "?"}` : "–"}
            </WbTd>
            <WbTd nowrap>
              {r.device === "desktop" ? "Desktop" : r.in_app ? "Mobile, In-App" : "Mobile"}
            </WbTd>
            <WbTd mono nowrap>{r.country ?? "–"}</WbTd>
          </WbRow>
        ))}
      </tbody>
    </WbTable>
  );
}

const METRIC_LABELS = {
  cta_click: "CTA-Klick",
  signup_started: "Sign-up gestartet",
  signup_confirmed: "Sign-up bestätigt",
} as const;

function ExperimentPanel({ report }: { report: ExperimentReport }) {
  const exp = report.experiment;
  const required = Number.isFinite(report.requiredPerVariant)
    ? num(report.requiredPerVariant)
    : "–";
  const progressPct = Math.round(report.progress * 100);
  const done = report.progress >= 1;

  return (
    <>
      <div className="wb-panel-body has-divider">
        <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 10 }}>
          <strong>Hypothese:</strong> {exp.hypothesis}
        </div>
        <div className="wb-meta-row">
          <span>
            Entscheidungsmetrik: <strong>{METRIC_LABELS[exp.primaryMetric]}</strong>
          </span>
          <span>
            Basisrate {pct(exp.baselineRate, 1)} · gesuchter Effekt +{Math.round(exp.relativeMde * 100)} %
          </span>
          <span>
            Geplant: <strong>{required}</strong> Besucher pro Variante
          </span>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="wb-note" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Stichprobe (kleinste Variante)</span>
            <span className="wb-num">
              {num(report.minVisitors)} von {required} · {progressPct} %
            </span>
          </div>
          <div className="wb-progress">
            <div className={`wb-progress-bar${done ? " is-done" : ""}`} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="wb-note" style={{ marginTop: 8, color: done ? "var(--wb-green)" : undefined }}>
            {done
              ? "Stichprobe erreicht: auswerten, Gewinner als Default schalten, Ergebnis ins Logbuch."
              : "Erst auswerten, wenn die Stichprobe voll ist. Zwischenstände wechseln bei kleinen Zahlen noch das Vorzeichen."}
          </div>
        </div>
      </div>

      <WbTable>
        <thead>
          <tr>
            <WbTh>Variante</WbTh>
            <WbTh align="right">Besucher</WbTh>
            <WbTh align="right">CTA</WbTh>
            <WbTh align="right">Gestartet</WbTh>
            <WbTh align="right">Bestätigt</WbTh>
            <WbTh align="right">{METRIC_LABELS[exp.primaryMetric]}</WbTh>
            <WbTh align="right">Lift</WbTh>
            <WbTh align="right">P(besser)</WbTh>
            <WbTh align="right">p-Wert</WbTh>
            <WbTh>Vorschau</WbTh>
          </tr>
        </thead>
        <tbody>
          {report.variants.map((v) => (
            <WbRow key={v.key}>
              <WbTd>
                <span style={{ fontWeight: 600 }}>{v.key.toUpperCase()}</span>
                {v.isControl ? (
                  <span style={{ marginLeft: 8 }}>
                    <WbBadge>Kontrolle</WbBadge>
                  </span>
                ) : null}
                <div className="wb-sub">{v.label}</div>
              </WbTd>
              <WbTd align="right"><WbNumeric value={num(v.counts.visitors)} bold /></WbTd>
              <WbTd align="right"><WbNumeric value={num(v.counts.ctaClickers)} /></WbTd>
              <WbTd align="right"><WbNumeric value={num(v.counts.starters)} /></WbTd>
              <WbTd align="right"><WbNumeric value={num(v.counts.confirmed)} /></WbTd>
              <WbTd align="right"><WbNumeric value={pct(v.successes, v.counts.visitors)} bold /></WbTd>
              <WbTd align="right"><WbNumeric value={v.comparison ? fmtLift(v.comparison.relativeLift) : "–"} /></WbTd>
              <WbTd align="right"><WbNumeric value={v.comparison ? fmtProb(v.comparison.probabilityBBeatsA) : "–"} /></WbTd>
              <WbTd align="right"><WbNumeric value={v.comparison ? fmtP(v.comparison.pValue) : "–"} /></WbTd>
              <WbTd nowrap>
                <a href={`/?v=${encodeURIComponent(v.key)}`} className="wb-link" target="_blank" rel="noreferrer">
                  /?v={v.key}
                </a>
              </WbTd>
            </WbRow>
          ))}
        </tbody>
      </WbTable>
      <div className="wb-panel-body wb-note" style={{ borderTop: "1px solid var(--wb-line-soft)" }}>
        P(besser) = Wahrscheinlichkeit, dass die Variante die Kontrolle auf der Entscheidungsmetrik
        schlägt. p-Wert = zweiseitiger Zwei-Anteile-Test. Beides erst ab 20 Besuchern pro Variante.
        Vorschau-Links werden nicht getrackt.
      </div>
    </>
  );
}
