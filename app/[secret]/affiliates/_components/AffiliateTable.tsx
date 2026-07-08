"use client";

import { useState } from "react";

import type { AffiliateRow } from "@/lib/admin/affiliate-queries";
import type { AffiliateLifecycle } from "@/lib/admin/affiliate-lifecycle";
import { deriveLifecycle } from "@/lib/admin/affiliate-lifecycle";
import { AffiliateDetailDrawer } from "./AffiliateDetailDrawer";

interface Props {
  rows: AffiliateRow[];
  search: string;
}

/**
 * Affiliate-Tabelle, on-brand. Card-Wrapper, weiche Lines, Sun-Tint
 * fuer Founding-Badge, soft tinted Status-Pills.
 */
export function AffiliateTable({ rows, search: initialSearch }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [selected, setSelected] = useState<AffiliateRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        [r.slug, r.name, r.email, r.notes ?? ""].some((field) =>
          field.toLowerCase().includes(q),
        ),
      )
    : rows;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search slug, name, email, notes…"
          style={{
            width: "100%",
            maxWidth: 360,
            background: "rgba(26,29,38,0.045)",
            border: "1px solid transparent",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 16,
            color: "var(--ink)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAffiliates={rows.length > 0} hasSearch={q.length > 0} />
      ) : (
        <div
          style={{
            background: "#ffffff",
            border: "0.5px solid var(--line)",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Slug · Name</Th>
                <Th>Email</Th>
                <Th align="right">Views</Th>
                <Th align="right">Sign-ups</Th>
                <Th align="right">Activated</Th>
                <Th>Status</Th>
                <Th align="right">Created</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="admin-row"
                  style={{
                    cursor: "pointer",
                    borderTop: "0.5px solid var(--line)",
                    transition: "background 0.12s",
                  }}
                >
                  <Td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--ink)",
                        }}
                      >
                        {row.slug}
                      </span>
                      {row.founder_tier ? (
                        <FoundingBadge />
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-faint)",
                        marginTop: 2,
                      }}
                    >
                      {row.name}
                    </div>
                  </Td>
                  <Td>
                    <span style={{ color: "var(--ink-dim)", fontSize: 14 }}>
                      {row.email}
                    </span>
                  </Td>
                  <Td align="right">
                    <NumCell value={row.view_count} muted />
                  </Td>
                  <Td align="right">
                    <NumCell value={row.signup_count} />
                  </Td>
                  <Td align="right">
                    <NumCell value={row.activated_count} muted />
                  </Td>
                  <Td>
                    <LifecyclePill lifecycle={deriveLifecycle(row)} />
                  </Td>
                  <Td align="right">
                    <span
                      style={{
                        color: "var(--ink-faint)",
                        fontSize: 13,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.created_at.slice(0, 10)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span style={{ color: "var(--ink-faint)", fontSize: 18 }}>
                      ›
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AffiliateDetailDrawer
        affiliate={selected ?? ({} as AffiliateRow)}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      style={{
        padding: "14px 18px",
        background: "var(--bg)",
        fontFamily: "var(--font-label)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "1.2px",
        color: "var(--ink-faint)",
        fontWeight: 600,
        textAlign: align === "right" ? "right" : "left",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      style={{
        padding: "14px 18px",
        textAlign: align === "right" ? "right" : "left",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function NumCell({ value, muted }: { value: number; muted?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 14,
        fontWeight: muted ? 500 : 600,
        color: muted ? "var(--ink-dim)" : "var(--ink)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}

function FoundingBadge() {
  return (
    <span
      style={{
        background: "var(--sun-tint)",
        color: "var(--sun-deep)",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        padding: "3px 8px",
        borderRadius: 6,
      }}
    >
      Founding
    </span>
  );
}

function LifecyclePill({ lifecycle }: { lifecycle: AffiliateLifecycle }) {
  const styles: Record<
    AffiliateLifecycle,
    { background: string; color: string; label: string }
  > = {
    created: {
      background: "rgba(26, 29, 38, 0.06)",
      color: "var(--ink-dim)",
      label: "Created",
    },
    invited: {
      background: "rgba(74, 122, 247, 0.12)",
      color: "var(--blue-deep)",
      label: "Invited",
    },
    active_logged_in: {
      background: "rgba(16, 185, 129, 0.12)",
      color: "#047857",
      label: "Active",
    },
    paused: {
      background: "rgba(245, 158, 11, 0.15)",
      color: "#a16207",
      label: "Paused",
    },
    removed: {
      background: "rgba(26, 29, 38, 0.07)",
      color: "var(--ink-faint)",
      label: "Removed",
    },
  };
  const s = styles[lifecycle];
  return (
    <span
      style={{
        background: s.background,
        color: s.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: "currentColor",
        }}
      />
      {s.label}
    </span>
  );
}

function EmptyState({
  hasAffiliates,
  hasSearch,
}: {
  hasAffiliates: boolean;
  hasSearch: boolean;
}) {
  let message: string;
  if (hasSearch) message = "No matches.";
  else if (!hasAffiliates)
    message = "No affiliates yet. Use the form above to add your first one.";
  else message = "No affiliates in this filter.";

  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px dashed var(--line)",
        borderRadius: 24,
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--ink-faint)",
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}
