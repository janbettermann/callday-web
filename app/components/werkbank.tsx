import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { CalldayLogo } from "./CalldayLogo";

/**
 * Werkbank: geteilte UI-Bausteine fuer die werkzeugartigen Bereiche der
 * Site (Admin unter /[secret], Affiliate-Portal unter /affiliate).
 * Optik liegt in app/werkbank.css, hier nur Struktur. Kein "use client":
 * alles hier ist in Server- und Client-Komponenten nutzbar.
 *
 * Die Huelle (WbShell) bekommt ihre Navigation von aussen; die Bereiche
 * kapseln das in AdminShell bzw. PortalShell.
 */

// ----------------------------------------------------------------
// Icons (Stroke-SVGs auf 24er-Raster)
// ----------------------------------------------------------------

export type WbIconName =
  | "grid"
  | "flask"
  | "list"
  | "users"
  | "logout"
  | "activity"
  | "post"
  | "wallet"
  | "settings"
  | "close"
  | "chevron";

const ICON_PATHS: Record<WbIconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  flask: <path d="M9 3h6M10 3v6l-5.5 9a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" />
    </>
  ),
  logout: <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  post: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 14h2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  close: <path d="M6 6l12 12M6 18L18 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
};

export function WbIcon({ name, size = 18 }: { name: WbIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ----------------------------------------------------------------
// Huelle: Seitenleiste + Kopfzeile + Inhalt
// ----------------------------------------------------------------

export interface WbNavItem {
  key: string;
  label: string;
  href: string;
  icon: WbIconName;
}

export function WbShell({
  tag,
  homeHref,
  navLabel,
  items,
  current,
  footer,
  title,
  subtitle,
  actions,
  children,
}: {
  /** Kleines Etikett neben dem Logo, z. B. "Admin" oder "Affiliate". */
  tag: string;
  homeHref: string;
  navLabel: string;
  items: WbNavItem[];
  current: string;
  /** Unten in der Seitenleiste, typischerweise das Abmelden-Formular. */
  footer?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="wb-shell">
      <aside className="wb-sidebar">
        <Link href={homeHref} className="wb-brand">
          <CalldayLogo size={26} />
          <span className="wb-brand-name">Callday</span>
          <span className="wb-brand-tag">{tag}</span>
        </Link>
        <nav className="wb-nav" aria-label={navLabel}>
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`wb-nav-item${item.key === current ? " is-active" : ""}`}
              aria-current={item.key === current ? "page" : undefined}
            >
              <WbIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        {footer ? <div className="wb-sidebar-foot">{footer}</div> : null}
      </aside>
      <div className="wb-main">
        <header className="wb-topbar">
          <div className="wb-topbar-heading">
            <h1 className="wb-topbar-title">{title}</h1>
            {subtitle ? <span className="wb-topbar-sub">{subtitle}</span> : null}
          </div>
          {actions ? <div className="wb-topbar-actions">{actions}</div> : null}
        </header>
        <div className="wb-content">{children}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Panel
// ----------------------------------------------------------------

export function WbPanel({
  title,
  subtitle,
  meta,
  padded,
  children,
}: {
  title?: string;
  subtitle?: string;
  meta?: ReactNode;
  /** Inhalt mit Innenabstand (Text, Formulare). Tabellen und
   *  Kennzahl-Leisten liegen buendig, also ohne. */
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="wb-panel">
      {title ? (
        <div className="wb-panel-head">
          <div className="wb-panel-heading">
            <h2 className="wb-panel-title">{title}</h2>
            {subtitle ? <span className="wb-panel-sub">{subtitle}</span> : null}
          </div>
          {meta ? <div className="wb-panel-meta">{meta}</div> : null}
        </div>
      ) : null}
      {padded ? <div className="wb-panel-body">{children}</div> : children}
    </section>
  );
}

// ----------------------------------------------------------------
// Tabelle
// ----------------------------------------------------------------

export function WbTable({ children }: { children: ReactNode }) {
  return <table className="wb-table">{children}</table>;
}

export function WbTh({
  children,
  align,
  width,
}: {
  children?: ReactNode;
  align?: "right";
  width?: number | string;
}) {
  return (
    <th className={align === "right" ? "is-right" : undefined} style={width ? { width } : undefined}>
      {children}
    </th>
  );
}

export function WbTd({
  children,
  align,
  muted,
  faint,
  nowrap,
  mono,
  wrap,
  colSpan,
  style,
}: {
  children: ReactNode;
  align?: "right";
  muted?: boolean;
  faint?: boolean;
  nowrap?: boolean;
  mono?: boolean;
  wrap?: boolean;
  colSpan?: number;
  style?: CSSProperties;
}) {
  const cls = [
    align === "right" ? "is-right" : "",
    muted ? "is-muted" : "",
    faint ? "is-faint" : "",
    nowrap ? "is-nowrap" : "",
    mono ? "is-mono" : "",
    wrap ? "is-wrap" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <td className={cls || undefined} colSpan={colSpan} style={style}>
      {children}
    </td>
  );
}

export function WbRow({ children, align }: { children: ReactNode; align?: "top" }) {
  return <tr className={`wb-row${align === "top" ? " is-top" : ""}`}>{children}</tr>;
}

export function WbNumeric({ value, bold }: { value: number | string; bold?: boolean }) {
  return <span className={`wb-num${bold ? " is-bold" : ""}`}>{value}</span>;
}

export function WbMailLink({ email, subject }: { email: string; subject?: string }) {
  const href = subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
  return (
    <a href={href} className="wb-link">
      {email}
    </a>
  );
}

export function WbEmpty({ children }: { children: ReactNode }) {
  return <div className="wb-empty">{children}</div>;
}

// ----------------------------------------------------------------
// Schalter und Kennzahlen
// ----------------------------------------------------------------

export function WbSegmented({
  items,
}: {
  items: Array<{ key: string; label: string; href: string; active: boolean; count?: number }>;
}) {
  return (
    <div className="wb-seg">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`wb-seg-item${item.active ? " is-active" : ""}`}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
          {item.count !== undefined ? <span className="wb-seg-count">{item.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

const nf = new Intl.NumberFormat("de-DE");

/** Absolute Differenz zur Vorperiode. Prozent waere bei einstelligen
 *  Zahlen nur Laerm. */
export function WbDelta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return <span className="wb-delta is-flat">±0</span>;
  return (
    <span className={`wb-delta ${diff > 0 ? "is-up" : "is-down"}`}>
      {diff > 0 ? "+" : "−"}
      {nf.format(Math.abs(diff))}
    </span>
  );
}

export interface WbMetricItem {
  key: string;
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  sub?: ReactNode;
  /** Momentaufnahme statt Zeitraum, grau hinterlegt. */
  snapshot?: boolean;
}

/** Kennzahlen als Leiste mit Trennlinien, buendig im Panel. */
export function WbMetricStrip({ items }: { items: WbMetricItem[] }) {
  return (
    <div
      className="wb-metrics"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.key} className={`wb-metric${item.snapshot ? " is-snapshot" : ""}`}>
          <div className="wb-metric-label">{item.label}</div>
          <div className="wb-metric-value">
            <span>{item.value}</span>
            {item.delta}
          </div>
          {item.sub ? <div className="wb-metric-sub">{item.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function WbTileGrid({ children }: { children: ReactNode }) {
  return <div className="wb-tile-grid">{children}</div>;
}

/** Freistehende Kennzahl-Kachel (fuer Seiten ohne Funnel-Leiste). */
export function WbStatTile({
  label,
  value,
  sub,
  accent,
  alert,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={`wb-tile${alert ? " is-alert" : ""}`}>
      <div className="wb-metric-label">{label}</div>
      <div className="wb-metric-value">
        <span>{value}</span>
        {accent}
      </div>
      {sub ? <div className="wb-metric-sub">{sub}</div> : null}
    </div>
  );
}

// ----------------------------------------------------------------
// Status, Badges, Hinweise
// ----------------------------------------------------------------

export type WbTone = "gray" | "blue" | "green" | "amber" | "red";

export function WbDot({ tone, children }: { tone: WbTone; children: ReactNode }) {
  return (
    <span className="wb-dot-label">
      <span className={`wb-dot is-${tone}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function WbBadge({ tone = "gray", children }: { tone?: WbTone; children: ReactNode }) {
  return <span className={`wb-badge is-${tone}`}>{children}</span>;
}

export function WbAlert({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="wb-alert" role="alert">
      <div className="wb-alert-title">{title}</div>
      {children}
    </div>
  );
}

export function WbNotice({ children }: { children: ReactNode }) {
  return <div className="wb-notice">{children}</div>;
}
