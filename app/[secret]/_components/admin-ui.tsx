/**
 * Geteilte UI-Bausteine fuer das Admin-Dashboard.
 *
 * Replaced die rohen Tailwind-Utilities durch Inline-Styles die CSS-
 * Brand-Vars (var(--ink), var(--line), var(--bg), var(--blue-deep), …)
 * referenzieren. Damit ist die Aesthetik konsistent zur Marketing-
 * Landing + zum on-brand Affiliate-Sub-Dashboard.
 *
 * Bewusst KEINE Tailwind-Utility-Klassen mehr — Brand-Vars sind die
 * Source of Truth fuer Farben und werden global in globals.css :root
 * gepflegt.
 */

import type { ReactNode } from "react";
import Link from "next/link";

export const monoLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  color: "var(--ink-faint)",
  fontWeight: 600,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid var(--line)",
  borderRadius: 20,
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
};

export function AdminCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return <div style={{ ...cardStyle, ...style }}>{children}</div>;
}

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <AdminCard>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        {children}
      </table>
    </AdminCard>
  );
}

export function AdminTh({
  children,
  align,
}: {
  children?: ReactNode;
  align?: "right";
}) {
  return (
    <th
      style={{
        ...monoLabelStyle,
        padding: "14px 18px",
        background: "var(--bg)",
        textAlign: align === "right" ? "right" : "left",
      }}
    >
      {children}
    </th>
  );
}

export function AdminTd({
  children,
  align,
  muted,
  nowrap,
  mono,
  style,
}: {
  children: ReactNode;
  align?: "right";
  muted?: boolean;
  nowrap?: boolean;
  mono?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "14px 18px",
        textAlign: align === "right" ? "right" : "left",
        whiteSpace: nowrap ? "nowrap" : "normal",
        fontFamily: mono ? "var(--font-mono), monospace" : undefined,
        fontSize: mono ? 12 : 14,
        color: muted ? "var(--ink-faint)" : "var(--ink-dim)",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export function AdminTRow({
  children,
  align,
}: {
  children: ReactNode;
  align?: "top";
}) {
  return (
    <tr
      className="admin-row"
      style={{
        borderTop: "0.5px solid var(--line)",
        transition: "background 0.12s",
        verticalAlign: align === "top" ? "top" : "middle",
      }}
    >
      {children}
    </tr>
  );
}

export function AdminMailLink({
  email,
  subject,
}: {
  email: string;
  subject?: string;
}) {
  const href = subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`;
  return (
    <a href={href} className="admin-link">
      {email}
    </a>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px dashed var(--line-strong)",
        borderRadius: 20,
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--ink-faint)",
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}

export function AdminMonoMeta({ children }: { children: ReactNode }) {
  return <div style={{ ...monoLabelStyle, fontSize: 11, letterSpacing: "1.5px" }}>{children}</div>;
}

/**
 * Globale Admin-Nav als Pill-Group. Wird oben rechts vor dem Sign-out-
 * Button gerendert. Beide Items immer sichtbar, current ist visuell
 * aktiv (dark fill) — analog der ViewTabs (Real / Internal / All) und
 * der StatusFilter-Pills auf /affiliates.
 */
export function AdminNav({
  current,
  basePath,
}: {
  current: "dashboard" | "affiliates";
  basePath: string;
}) {
  const items: Array<{ key: "dashboard" | "affiliates"; label: string; href: string }> = [
    { key: "dashboard", label: "Dashboard", href: basePath },
    { key: "affiliates", label: "Affiliates", href: `${basePath}/affiliates` },
  ];

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
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            style={
              active
                ? {
                    background: "var(--ink)",
                    color: "#ffffff",
                    borderRadius: 9,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                  }
                : {
                    color: "var(--ink-dim)",
                    borderRadius: 9,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                  }
            }
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminNumeric({
  value,
  bold,
}: {
  value: number | string;
  bold?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 14,
        fontWeight: bold ? 700 : 500,
        color: bold ? "var(--ink)" : "var(--ink-dim)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}
