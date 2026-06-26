import Link from "next/link";

import type { AffiliateStatus } from "@/lib/admin/affiliate-queries";

export type StatusFilterValue = "all" | AffiliateStatus;

const ORDER: StatusFilterValue[] = ["all", "active", "paused", "removed"];
const LABEL: Record<StatusFilterValue, string> = {
  all: "All",
  active: "Active",
  paused: "Paused",
  removed: "Removed",
};

interface Props {
  current: StatusFilterValue;
  counts: Record<StatusFilterValue, number>;
  basePath: string;
}

/**
 * Status-Filter-Pills. Wir nutzen Link-Navigation (Query-Param) statt
 * Client-State, damit der Filter share-bar ist und beim Refresh stehen
 * bleibt. Counts werden vom Server-Component vorberechnet und als Pill-
 * Badge angezeigt.
 */
export function StatusFilter({ current, counts, basePath }: Props) {
  return (
    <div className="mb-6 inline-flex rounded-xl border border-[#1a1d26]/[0.08] bg-white p-1 shadow-sm">
      {ORDER.map((value) => {
        const active = value === current;
        const href = value === "all" ? basePath : `${basePath}?status=${value}`;
        return (
          <Link
            key={value}
            href={href}
            className={
              active
                ? "flex items-center gap-1.5 rounded-lg bg-[#1a1d26] px-3.5 py-1.5 text-sm font-medium text-white"
                : "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-[#1a1d26]/60 hover:text-[#1a1d26]"
            }
          >
            {LABEL[value]}
            <span
              className={
                active
                  ? "tabular-nums opacity-70"
                  : "tabular-nums text-[#1a1d26]/35"
              }
            >
              {counts[value]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
