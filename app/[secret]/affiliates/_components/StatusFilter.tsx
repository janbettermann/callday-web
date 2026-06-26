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
 * Status-Filter — pill-group im Stil der Landing-Page-Pills
 * (rounded, soft shadow, segmented active state).
 */
export function StatusFilter({ current, counts, basePath }: Props) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 14,
        padding: 4,
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
      }}
    >
      {ORDER.map((value) => {
        const active = value === current;
        const href = value === "all" ? basePath : `${basePath}?status=${value}`;
        return (
          <Link
            key={value}
            href={href}
            style={
              active
                ? {
                    background: "var(--ink)",
                    color: "#ffffff",
                    borderRadius: 10,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }
                : {
                    color: "var(--ink-dim)",
                    borderRadius: 10,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }
            }
          >
            {LABEL[value]}
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                opacity: active ? 0.65 : 0.45,
              }}
            >
              {counts[value]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
