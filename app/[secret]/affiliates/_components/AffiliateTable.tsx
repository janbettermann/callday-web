"use client";

import { useState } from "react";

import type { AffiliateRow } from "@/lib/admin/affiliate-queries";
import { deriveLifecycle } from "@/lib/admin/affiliate-lifecycle";

import {
  WbBadge,
  WbDot,
  WbEmpty,
  WbNumeric,
  WbTable,
  WbTd,
  WbTh,
} from "../../_components/admin-ui";
import { AffiliateDetailDrawer } from "./AffiliateDetailDrawer";
import { LIFECYCLE } from "./lifecycle-ui";

interface Props {
  rows: AffiliateRow[];
  search: string;
}

/**
 * Affiliate-Tabelle im Werkbank-Panel: Suchzeile oben, Klick auf eine
 * Zeile oeffnet den Detail-Drawer.
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
      <div className="wb-toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Slug, Name, E-Mail, Notizen suchen"
          className="wb-input"
          style={{ maxWidth: 360, height: 32 }}
        />
        <span style={{ fontSize: 12, color: "var(--wb-ink-3)" }}>
          {filtered.length} von {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <WbEmpty>
          {q
            ? "Keine Treffer."
            : rows.length === 0
              ? "Noch keine Affiliates. Oben den ersten anlegen."
              : "Keine Affiliates in diesem Filter."}
        </WbEmpty>
      ) : (
        <WbTable>
          <thead>
            <tr>
              <WbTh>Slug · Name</WbTh>
              <WbTh>E-Mail</WbTh>
              <WbTh align="right">Views</WbTh>
              <WbTh align="right">Sign-ups</WbTh>
              <WbTh align="right">Aktiviert</WbTh>
              <WbTh>Status</WbTh>
              <WbTh align="right">Angelegt</WbTh>
              <WbTh width={40} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const lc = LIFECYCLE[deriveLifecycle(row)];
              return (
                <tr key={row.id} onClick={() => setSelected(row)} className="wb-row is-click">
                  <WbTd>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--wb-mono)", fontWeight: 600 }}>{row.slug}</span>
                      {row.founder_tier ? <WbBadge tone="amber">Founding</WbBadge> : null}
                    </div>
                    <div className="wb-sub">{row.name}</div>
                  </WbTd>
                  <WbTd muted>{row.email}</WbTd>
                  <WbTd align="right"><WbNumeric value={row.view_count} /></WbTd>
                  <WbTd align="right"><WbNumeric value={row.signup_count} bold /></WbTd>
                  <WbTd align="right"><WbNumeric value={row.activated_count} /></WbTd>
                  <WbTd nowrap><WbDot tone={lc.tone}>{lc.label}</WbDot></WbTd>
                  <WbTd align="right" nowrap muted>
                    <WbNumeric value={row.created_at.slice(0, 10)} />
                  </WbTd>
                  <WbTd align="right" faint>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </WbTd>
                </tr>
              );
            })}
          </tbody>
        </WbTable>
      )}

      <AffiliateDetailDrawer
        affiliate={selected ?? ({} as AffiliateRow)}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
