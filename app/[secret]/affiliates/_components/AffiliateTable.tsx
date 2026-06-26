"use client";

import { useState } from "react";

import type {
  AffiliateRow,
  AffiliateStatus,
} from "@/lib/admin/affiliate-queries";
import { AffiliateDetailDrawer } from "./AffiliateDetailDrawer";

interface Props {
  rows: AffiliateRow[];
  search: string;
}

/**
 * Affiliate-Tabelle. Client-Component damit:
 *   - Search-Input live filtert
 *   - Detail-Drawer per Row-Click oeffnet (lokaler State)
 *
 * Server-Side waeren beide via URL-Params + Modal-Route loesbar, aber
 * der UX-Gewinn (sofortiges Filtern beim Tippen) ist es wert.
 *
 * Such-Match: case-insensitive ueber slug, name, email, notes.
 */
export function AffiliateTable({ rows, search: initialSearch }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [selected, setSelected] = useState<AffiliateRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        [r.slug, r.name, r.email, r.notes ?? ""]
          .some((field) => field.toLowerCase().includes(q)),
      )
    : rows;

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search slug, name, email, notes…"
          className="w-full max-w-sm rounded-lg border border-[#1a1d26]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#4a7af7]"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAffiliates={rows.length > 0} hasSearch={q.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#1a1d26]/[0.06] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#faf9f5] text-left text-[11px] uppercase tracking-wider text-[#1a1d26]/45">
              <tr>
                <th className="px-4 py-3">Slug · Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Sign-ups</th>
                <th className="px-4 py-3 text-right">Activated</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Created</th>
                <th className="px-4 py-3 text-right">{/* edit chevron */}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1d26]/[0.06]">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer hover:bg-[#1a1d26]/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-[13px] font-medium text-[#1a1d26]">
                      {row.slug}
                      {row.founder_tier ? (
                        <span className="ml-2 rounded bg-[#fde68a] px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-[#92400e]">
                          Founding
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-[#1a1d26]/55">
                      {row.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#1a1d26]/75">{row.email}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.signup_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.activated_count}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-[#1a1d26]/55 tabular-nums">
                    {row.created_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#1a1d26]/35">
                    ›
                  </td>
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

function StatusPill({ status }: { status: AffiliateStatus }) {
  const styles: Record<AffiliateStatus, string> = {
    active: "bg-[#16a34a]/10 text-[#15803d]",
    paused: "bg-[#f59e0b]/15 text-[#a16207]",
    removed: "bg-[#1a1d26]/8 text-[#1a1d26]/50",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      {status}
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
  if (hasSearch) {
    return (
      <div className="rounded-xl border border-dashed border-[#1a1d26]/12 bg-white p-8 text-center text-sm text-[#1a1d26]/55">
        No matches.
      </div>
    );
  }
  if (!hasAffiliates) {
    return (
      <div className="rounded-xl border border-dashed border-[#1a1d26]/12 bg-white p-8 text-center text-sm text-[#1a1d26]/55">
        No affiliates yet. Use the form above to add your first one.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-[#1a1d26]/12 bg-white p-8 text-center text-sm text-[#1a1d26]/55">
      No affiliates in this filter.
    </div>
  );
}
