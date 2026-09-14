import Link from "next/link";
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
  AdminEmptyState,
  AdminNav,
  AdminNumeric,
  AdminTRow,
  AdminTable,
  AdminTd,
  AdminTh,
  monoLabelStyle,
} from "../_components/admin-ui";
import { logoutAction } from "../actions";

/**
 * /[secret]/experiments — Landing-Funnel + Split-Test-Auswertung.
 *
 * Datenquelle ist lp_events (lib/lp, Migration 0058 im App-Repo). Oben
 * der Funnel ueber alle Besucher (Baseline: was bringen die Ads?), nach
 * Quelle und Geraet; darunter das aktive Experiment mit Varianten-
 * Vergleich, Stichproben-Fortschritt und Signifikanz. Auth + Composition
 * wie /[secret]/lists.
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
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <header style={{ marginBottom: 36 }}>
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
            <AdminNav current="experiments" basePath={basePath} />
            <form action={logoutAction}>
              <button type="submit" style={signOutStyle}>
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
              margin: "0 0 8px",
              color: "var(--ink)",
            }}
          >
            Landing-Experimente
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-dim)", maxWidth: 640 }}>
            Besucher, CTA-Klicks und Sign-ups der Landing Page, cookielos
            aus lp_events. Ein Besucher zaehlt pro Schritt hoechstens einmal.
            Workflow und Stichproben-Tabelle: docs/experiments.md.
          </p>
        </header>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
          <Tabs
            items={RANGES.map((r) => ({
              key: r.key,
              label: r.label,
              href: tabHref(r.key, page),
              active: r.key === range,
            }))}
          />
          <Tabs
            items={[
              { key: "landing", label: "Landing", href: tabHref(range, "landing"), active: page === "landing" },
              { key: "affiliate", label: "Affiliate-Landings", href: tabHref(range, "affiliate"), active: page === "affiliate" },
            ]}
          />
        </div>

        {loadError && (
          <p className="beta-submit-error" role="alert">
            {loadError}
          </p>
        )}

        {tableMissing && (
          <Notice tone="warn">
            Die Tabelle <code>lp_events</code> existiert noch nicht. Migration
            <code> 0058_lp_events.sql</code> im App-Repo anwenden (siehe
            docs/experiments.md), danach laufen die Zahlen hier auf.
          </Notice>
        )}

        <Section title="Funnel" subtitle={`Alle Besucher der ${page === "landing" ? "Landing" : "Affiliate-Landings"} im Zeitraum`}>
          <FunnelTiles counts={total} />
        </Section>

        {page === "landing" && (
          <Section
            title="Aktives Experiment"
            subtitle={
              report
                ? `${report.experiment.name} · seit ${report.experiment.startedAt} (${report.daysRunning} Tage)`
                : "Kein Test aktiv — die Seite laeuft als Default, der Funnel oben ist die Baseline"
            }
          >
            {report ? (
              <ExperimentPanel report={report} />
            ) : (
              <AdminEmptyState>
                Einen Test starten: in <code>lib/lp/experiments.ts</code> das
                Objekt <code>ACTIVE_EXPERIMENT</code> befuellen, die Variante in{" "}
                <code>app/page.tsx</code> verzweigen, deployen. Ab dann zaehlt
                jeder Besucher fuer eine Variante.
              </AdminEmptyState>
            )}
          </Section>
        )}

        <Section title="Nach Quelle" subtitle="UTM schlaegt Referrer; fbclid ohne UTM zaehlt als Meta">
          <FunnelTable
            rows={sources.map((s) => ({ key: s.key, label: SOURCE_LABELS[s.key], counts: s.counts }))}
          />
        </Section>

        <Section title="Nach Geraet" subtitle="Meta-Traffic landet fast komplett im Instagram-/Facebook-In-App-Browser">
          <FunnelTable
            rows={devices.map((d) => ({
              key: d.key,
              label: DEVICE_ORDER.find((x) => x.key === d.key)?.label ?? d.key,
              counts: d.counts,
            }))}
          />
        </Section>

        <Section title="Pro Tag" subtitle="UTC-Tage, Luecken sind Tage ohne Besucher">
          <DailyTable rows={daily} />
        </Section>

        <Section title="Letzte Sign-ups" subtitle="Bestaetigte Accounts mit Herkunft, neueste zuerst">
          <SignupsTable rows={signups} />
        </Section>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Bausteine
// ----------------------------------------------------------------

const signOutStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid var(--line)",
  color: "var(--ink-dim)",
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
};

function Tabs({
  items,
}: {
  items: Array<{ key: string; label: string; href: string; active: boolean }>;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 12,
        padding: 3,
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
      }}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          style={{
            background: item.active ? "var(--ink)" : "transparent",
            color: item.active ? "#ffffff" : "var(--ink-dim)",
            borderRadius: 9,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...monoLabelStyle, fontSize: 11, letterSpacing: "1.5px", marginBottom: 6 }}>
          {title}
        </div>
        {subtitle ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-dim)", lineHeight: 1.5 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Notice({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  const color = tone === "warn" ? "#92400e" : "var(--blue-deep)";
  const bg = tone === "warn" ? "rgba(245, 158, 11, 0.08)" : "rgba(74, 122, 247, 0.06)";
  return (
    <div
      style={{
        marginBottom: 28,
        border: `0.5px solid ${tone === "warn" ? "rgba(245,158,11,0.4)" : "rgba(74,122,247,0.3)"}`,
        background: bg,
        borderRadius: 14,
        padding: "14px 18px",
        fontSize: 14,
        color,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

function FunnelTiles({ counts }: { counts: FunnelCounts }) {
  const tiles = [
    { label: "Besucher", value: num(counts.visitors), sub: "Distinct, mit JS geladen" },
    { label: "CTA geklickt", value: num(counts.ctaClickers), sub: pct(counts.ctaClickers, counts.visitors) + " der Besucher" },
    { label: "Sign-up gestartet", value: num(counts.starters), sub: pct(counts.starters, counts.visitors) + " der Besucher" },
    { label: "Bestaetigt", value: num(counts.confirmed), sub: pct(counts.confirmed, counts.visitors, 2) + " der Besucher" },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 12,
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 16,
            padding: "16px 18px",
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          <div style={monoLabelStyle}>{t.label}</div>
          <div
            style={{
              marginTop: 8,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.6px",
              color: "var(--ink)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {t.value}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-faint)" }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

function FunnelTable({
  rows,
}: {
  rows: Array<{ key: string; label: string; counts: FunnelCounts }>;
}) {
  return (
    <AdminTable>
      <thead>
        <tr>
          <AdminTh>Segment</AdminTh>
          <AdminTh align="right">Besucher</AdminTh>
          <AdminTh align="right">CTA</AdminTh>
          <AdminTh align="right">Gestartet</AdminTh>
          <AdminTh align="right">Bestaetigt</AdminTh>
          <AdminTh align="right">Start-Rate</AdminTh>
          <AdminTh align="right">Confirm-Rate</AdminTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <AdminTRow key={r.key}>
            <AdminTd nowrap style={{ color: "var(--ink)", fontWeight: 500 }}>
              {r.label}
            </AdminTd>
            <AdminTd align="right"><AdminNumeric value={num(r.counts.visitors)} bold /></AdminTd>
            <AdminTd align="right"><AdminNumeric value={num(r.counts.ctaClickers)} /></AdminTd>
            <AdminTd align="right"><AdminNumeric value={num(r.counts.starters)} /></AdminTd>
            <AdminTd align="right"><AdminNumeric value={num(r.counts.confirmed)} /></AdminTd>
            <AdminTd align="right"><AdminNumeric value={pct(r.counts.starters, r.counts.visitors)} /></AdminTd>
            <AdminTd align="right"><AdminNumeric value={pct(r.counts.confirmed, r.counts.visitors, 2)} /></AdminTd>
          </AdminTRow>
        ))}
      </tbody>
    </AdminTable>
  );
}

function DailyTable({ rows }: { rows: Array<{ date: string; counts: FunnelCounts }> }) {
  const hasAny = rows.some((r) => r.counts.visitors > 0);
  if (!hasAny) {
    return <AdminEmptyState>Noch keine Besucher im Zeitraum.</AdminEmptyState>;
  }
  return (
    <AdminTable>
      <thead>
        <tr>
          <AdminTh>Tag</AdminTh>
          <AdminTh align="right">Besucher</AdminTh>
          <AdminTh align="right">CTA</AdminTh>
          <AdminTh align="right">Gestartet</AdminTh>
          <AdminTh align="right">Bestaetigt</AdminTh>
        </tr>
      </thead>
      <tbody>
        {rows
          .slice()
          .reverse()
          .map((r) => (
            <AdminTRow key={r.date}>
              <AdminTd mono nowrap>{r.date}</AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(r.counts.visitors)} bold /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(r.counts.ctaClickers)} /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(r.counts.starters)} /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(r.counts.confirmed)} /></AdminTd>
            </AdminTRow>
          ))}
      </tbody>
    </AdminTable>
  );
}

function SignupsTable({ rows }: { rows: RecentSignupRow[] }) {
  if (rows.length === 0) {
    return <AdminEmptyState>Noch kein bestaetigter Sign-up ueber die Landing im Zeitraum.</AdminEmptyState>;
  }
  return (
    <AdminTable>
      <thead>
        <tr>
          <AdminTh>Zeit</AdminTh>
          <AdminTh>Email</AdminTh>
          <AdminTh>Quelle</AdminTh>
          <AdminTh>Kampagne / Anzeige</AdminTh>
          <AdminTh>Variante</AdminTh>
          <AdminTh>Geraet</AdminTh>
          <AdminTh>Land</AdminTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <AdminTRow key={`${r.created_at}-${i}`}>
            <AdminTd nowrap muted>{formatDateTime(r.created_at)}</AdminTd>
            <AdminTd style={{ color: "var(--ink)" }}>{r.email ?? "–"}</AdminTd>
            <AdminTd nowrap>{SOURCE_LABELS[r.source]}</AdminTd>
            <AdminTd muted>
              {[r.utm_campaign, r.utm_content].filter(Boolean).join(" / ") || "–"}
            </AdminTd>
            <AdminTd mono nowrap>
              {r.experiment_key ? `${r.experiment_key} · ${r.variant ?? "?"}` : "–"}
            </AdminTd>
            <AdminTd nowrap>
              {r.device === "desktop" ? "Desktop" : r.in_app ? "Mobile, In-App" : "Mobile"}
            </AdminTd>
            <AdminTd mono nowrap>{r.country ?? "–"}</AdminTd>
          </AdminTRow>
        ))}
      </tbody>
    </AdminTable>
  );
}

const METRIC_LABELS = {
  cta_click: "CTA-Klick",
  signup_started: "Sign-up gestartet",
  signup_confirmed: "Sign-up bestaetigt",
} as const;

function ExperimentPanel({ report }: { report: ExperimentReport }) {
  const exp = report.experiment;
  const required = Number.isFinite(report.requiredPerVariant)
    ? num(report.requiredPerVariant)
    : "–";
  const progressPct = Math.round(report.progress * 100);
  const done = report.progress >= 1;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          background: "#ffffff",
          border: "0.5px solid var(--line)",
          borderRadius: 16,
          padding: "18px 20px",
          boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
        }}
      >
        <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.55, marginBottom: 12 }}>
          <strong>Hypothese:</strong> {exp.hypothesis}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px", fontSize: 13, color: "var(--ink-dim)" }}>
          <span>
            Entscheidungsmetrik: <strong style={{ color: "var(--ink)" }}>{METRIC_LABELS[exp.primaryMetric]}</strong>
          </span>
          <span>
            Basisrate {pct(exp.baselineRate, 1)} · gesuchter Effekt +{Math.round(exp.relativeMde * 100)} %
          </span>
          <span>
            Geplant: <strong style={{ color: "var(--ink)" }}>{required}</strong> Besucher pro Variante
          </span>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-faint)", marginBottom: 6 }}>
            <span>Stichprobe (kleinste Variante)</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {num(report.minVisitors)} von {required} · {progressPct} %
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(26,29,38,0.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                borderRadius: 999,
                background: done ? "var(--green)" : "var(--blue)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: done ? "var(--green-deep)" : "var(--ink-faint)" }}>
            {done
              ? "Stichprobe erreicht — auswerten, Gewinner als Default schalten, Ergebnis ins Logbuch."
              : "Erst auswerten, wenn die Stichprobe voll ist. Zwischenstaende wechseln bei kleinen Zahlen noch das Vorzeichen."}
          </div>
        </div>
      </div>

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Variante</AdminTh>
            <AdminTh align="right">Besucher</AdminTh>
            <AdminTh align="right">CTA</AdminTh>
            <AdminTh align="right">Gestartet</AdminTh>
            <AdminTh align="right">Bestaetigt</AdminTh>
            <AdminTh align="right">{METRIC_LABELS[exp.primaryMetric]}</AdminTh>
            <AdminTh align="right">Lift</AdminTh>
            <AdminTh align="right">P(besser)</AdminTh>
            <AdminTh align="right">p-Wert</AdminTh>
            <AdminTh>Vorschau</AdminTh>
          </tr>
        </thead>
        <tbody>
          {report.variants.map((v) => (
            <AdminTRow key={v.key}>
              <AdminTd>
                <div style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {v.key.toUpperCase()}
                  {v.isControl ? (
                    <span style={{ ...monoLabelStyle, marginLeft: 8 }}>Kontrolle</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>{v.label}</div>
              </AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(v.counts.visitors)} bold /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(v.counts.ctaClickers)} /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(v.counts.starters)} /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={num(v.counts.confirmed)} /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={pct(v.successes, v.counts.visitors)} bold /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={v.comparison ? fmtLift(v.comparison.relativeLift) : "–"} /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={v.comparison ? fmtProb(v.comparison.probabilityBBeatsA) : "–"} /></AdminTd>
              <AdminTd align="right"><AdminNumeric value={v.comparison ? fmtP(v.comparison.pValue) : "–"} /></AdminTd>
              <AdminTd nowrap>
                <a href={`/?v=${encodeURIComponent(v.key)}`} className="admin-link" target="_blank" rel="noreferrer">
                  /?v={v.key}
                </a>
              </AdminTd>
            </AdminTRow>
          ))}
        </tbody>
      </AdminTable>
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.5 }}>
        P(besser) = Wahrscheinlichkeit, dass die Variante die Kontrolle auf
        der Entscheidungsmetrik schlaegt. p-Wert = zweiseitiger Zwei-Anteile-
        Test. Beides erst ab 20 Besuchern pro Variante. Vorschau-Links werden
        nicht getrackt.
      </p>
    </div>
  );
}
