"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
  // Ein geteiltes Info-Sheet für alle "Reversed"-Zeilen (gleiche Erklärung).
  const [infoOpen, setInfoOpen] = useState(false);

  // Nur Status-Filter — kein Zeitraum: der Status ist auf Earnings quasi schon
  // die Zeit-Achse (pending = innerhalb Hold, available/paid = nach Hold), ein Zeit-Filter
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
              <EarningRow
                key={r.id}
                row={r}
                first={i === 0}
                onInfo={() => setInfoOpen(true)}
              />
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

      <ReversalInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

const STATUS_STYLE: Record<
  CommissionStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Pending",
    color: "var(--sun-deep)",
    bg: "rgba(185,126,16,0.1)",
  },
  available: {
    label: "Available",
    color: "var(--blue-deep)",
    bg: "rgba(53,100,224,0.1)",
  },
  paid: { label: "Paid", color: "#0f766e", bg: "rgba(15,118,110,0.1)" },
  clawback: { label: "Refunded", color: "#b91c1c", bg: "rgba(185,28,28,0.1)" },
};

const RECOVERY_BADGE = {
  label: "Reversed",
  color: "#b91c1c",
  bg: "rgba(185,28,28,0.1)",
};

/** Kurzdatum "Apr 5" für den Reverses-Hinweis. */
function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function EarningRow({
  row,
  first,
  onInfo,
}: {
  row: CommissionRow;
  first: boolean;
  onInfo: () => void;
}) {
  // Recovery-Buchungen (Post-Payout-Refund, negativer Betrag) rendern als rote
  // "Reversed"-Zeile statt mit ihrem technischen Status ("available"). Der
  // Betrag zählt weiter in die Available-Rechnung (bewusst — bleibt unter dem
  // Available-Filter, siehe specs/affiliate-payouts.md §9).
  const s = row.isRecovery ? RECOVERY_BADGE : STATUS_STYLE[row.status];
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
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          minWidth: 0,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          {row.isRecovery ? (
            <button
              type="button"
              onClick={onInfo}
              aria-label="What does Reversed mean?"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "none",
                border: "none",
                padding: 2,
                cursor: "pointer",
                color: "var(--ink-faint)",
                lineHeight: 0,
              }}
            >
              <InfoIcon />
            </button>
          ) : null}
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
        {row.isRecovery && row.reverses_charged_at ? (
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            reverses your {fmtShortDate(row.reverses_charged_at)} commission
          </span>
        ) : null}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: row.isRecovery ? "#b91c1c" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {formatMoney(row.commission_cents, row.charge_currency)}
      </span>
    </li>
  );
}

function InfoIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={16} x2={12} y2={12} />
      <line x1={12} y1={8} x2={12.01} y2={8} />
    </svg>
  );
}

/**
 * Info-Modal, das erklärt was "Reversed" bedeutet. Nutzt das geteilte Overlay-
 * Muster des Affiliate-Dashboards (analog PostComposer): `createPortal` auf
 * `document.body` + `.pc-backdrop` / `.pc-panel` aus globals.css → Desktop
 * zentriertes Modal, Mobile Bottom-Sheet, z-index 10000 ÜBER dem Footer. Der
 * Portal löst zudem die Stacking-Context-Falle (kein `position:fixed` mehr tief
 * im Baum). Body-Scroll gesperrt; schließt bei Backdrop-Klick, "Got it", Escape.
 */
function ReversalInfoSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="pc-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="What Reversed means"
      onClick={onClose}
    >
      <div className="pc-panel" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "1.2px",
              color: "#b91c1c",
            }}
          >
            Reversed
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              color: "var(--ink-faint)",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              marginTop: -4,
              marginRight: -6,
            }}
          >
            ×
          </button>
        </div>

        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "-0.3px",
            color: "var(--ink)",
          }}
        >
          A paid commission was refunded
        </h2>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink-dim)",
          }}
        >
          A commission that was{" "}
          <strong style={{ color: "var(--ink)" }}>already paid out</strong> to you
          was later refunded by the customer. Since the money was already sent,
          the amount is recovered from your{" "}
          <strong style={{ color: "var(--ink)" }}>Available</strong> balance.
        </p>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink-dim)",
          }}
        >
          Your original payout stays in your history — this line just balances it
          out. If a refund happens <em>before</em> a commission is paid, it simply
          shows as <em>Refunded</em> and never counts.
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            background:
              "linear-gradient(135deg, var(--blue) 0%, var(--blue-deep) 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}
