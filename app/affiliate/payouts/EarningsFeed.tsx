"use client";

import { useMemo, useState } from "react";

import {
  formatMoney,
  type CommissionRow,
  type CommissionStatus,
} from "@/lib/affiliate-commissions";
import { FilterMenu } from "../FilterMenu";

// Liste kappen (bei vielen Referrals sonst hunderte Rows).
const EARNINGS_CAP = 12;

type StatusFilter = "all" | CommissionStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All commissions" },
  { value: "pending", label: "Pending" },
  { value: "available", label: "Available" },
  { value: "paid", label: "Paid" },
  { value: "clawback", label: "Refunded" },
];

/**
 * Earnings-Liste der Payout-Seite mit zwei Filter-Pillen (Status + Zeitraum)
 * aus der geteilten `FilterMenu`. Clientseitig gefiltert auf den bereits
 * geladenen Rows (Status ist schon abgeleitet), dann auf `EARNINGS_CAP` gekappt.
 */
export function EarningsFeed({ rows }: { rows: CommissionRow[] }) {
  const [status, setStatus] = useState<StatusFilter>("all");

  // Nur Status-Filter — kein Zeitraum: der Status ist auf Earnings quasi schon
  // die Zeit-Achse (pending = <90d, available/paid = >=90d), ein Zeit-Filter
  // erzeugt v.a. verwirrende Immer-leer-Kombinationen (z.B. „diese Woche" +
  // „Available"). Zeit-Filter lebt weiter auf /affiliate/activity (dort ist
  // Zeit eine unabhängige Achse).
  const filtered = useMemo(
    () => (status === "all" ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

  const shown = filtered.slice(0, EARNINGS_CAP);
  const more = filtered.length - shown.length;

  return (
    <>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}
      >
        <FilterMenu
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 14 }}>
          No earnings match these filters.
        </p>
      ) : (
        <>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {shown.map((r, i) => (
              <EarningRow key={r.id} row={r} first={i === 0} />
            ))}
          </ul>
          {more > 0 ? (
            <p
              style={{
                margin: "16px 0 0",
                fontSize: 13,
                color: "var(--ink-faint)",
                textAlign: "center",
              }}
            >
              + {more} more commissions
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

const STATUS_STYLE: Record<
  CommissionStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Pending",
    color: "#d97706",
    bg: "rgba(251,191,36,0.18)",
  },
  available: {
    label: "Available",
    color: "var(--blue-deep)",
    bg: "rgba(53,100,224,0.1)",
  },
  paid: { label: "Paid", color: "#0f766e", bg: "rgba(15,118,110,0.1)" },
  clawback: { label: "Refunded", color: "#b91c1c", bg: "rgba(185,28,28,0.1)" },
};

function EarningRow({ row, first }: { row: CommissionRow; first: boolean }) {
  const s = STATUS_STYLE[row.status];
  const date = new Date(row.charged_at).toISOString().slice(0, 10);
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderTop: first ? "none" : "0.5px solid var(--line)",
        gap: 12,
      }}
    >
      <span
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: s.color,
            background: s.bg,
            borderRadius: 6,
            padding: "3px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {s.label}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "var(--ink-faint)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {date}
        </span>
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {formatMoney(row.commission_cents, row.charge_currency)}
      </span>
    </li>
  );
}
