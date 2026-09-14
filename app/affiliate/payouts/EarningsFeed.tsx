"use client";

import { useMemo, useState } from "react";

import {
  formatMoney,
  type CommissionRow,
  type CommissionStatus,
} from "@/lib/affiliate-commissions";
import {
  WbBadge,
  WbEmpty,
  WbRow,
  WbTable,
  WbTd,
  WbTh,
  type WbTone,
} from "@/app/components/werkbank";
import { WbModal } from "@/app/components/werkbank-modal";

import { SegmentedButtons } from "../SegmentedButtons";

// Liste kappen (bei vielen Referrals sonst hunderte Rows).
const EARNINGS_CAP = 12;

type StatusFilter = "all" | CommissionStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "available", label: "Available" },
  { value: "paid", label: "Paid" },
  { value: "clawback", label: "Refunded" },
];

const STATUS_BADGE: Record<CommissionStatus, { label: string; tone: WbTone }> = {
  pending: { label: "Pending", tone: "amber" },
  available: { label: "Available", tone: "blue" },
  paid: { label: "Paid", tone: "green" },
  clawback: { label: "Refunded", tone: "gray" },
};

/** Kurzdatum "Apr 5" fuer den Reverses-Hinweis. */
function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Earnings-Tabelle der Payout-Seite mit Status-Schalter in der Werkzeug-
 * leiste. Kein Zeit-Filter: der Status ist auf Earnings quasi schon die
 * Zeit-Achse (pending = innerhalb Hold, available/paid = nach Hold).
 */
export function EarningsFeed({ rows }: { rows: CommissionRow[] }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  // Ein geteiltes Info-Modal fuer alle "Reversed"-Zeilen (gleiche Erklaerung).
  const [infoOpen, setInfoOpen] = useState(false);

  const filtered = useMemo(
    () => (status === "all" ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

  const shown = filtered.slice(0, EARNINGS_CAP);
  const more = filtered.length - shown.length;

  return (
    <>
      <div className="wb-toolbar" style={{ flexWrap: "wrap" }}>
        <SegmentedButtons options={STATUS_OPTIONS} value={status} onChange={setStatus} label="Status" />
        <span style={{ fontSize: 12, color: "var(--wb-ink-3)", marginLeft: "auto" }}>
          {filtered.length} of {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <WbEmpty>No commissions match this filter.</WbEmpty>
      ) : (
        <WbTable>
          <thead>
            <tr>
              <WbTh>Status</WbTh>
              <WbTh>Date</WbTh>
              <WbTh>Note</WbTh>
              <WbTh align="right">Amount</WbTh>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              // Recovery-Buchungen (Post-Payout-Refund, negativer Betrag) rendern
              // als "Reversed" statt mit ihrem technischen Status ("available").
              const badge = r.isRecovery
                ? { label: "Reversed", tone: "red" as WbTone }
                : STATUS_BADGE[r.status];
              return (
                <WbRow key={r.id}>
                  <WbTd nowrap>
                    <span className="wb-inline" style={{ gap: 6 }}>
                      <WbBadge tone={badge.tone}>{badge.label}</WbBadge>
                      {r.isRecovery ? (
                        <button
                          type="button"
                          onClick={() => setInfoOpen(true)}
                          aria-label="What does Reversed mean?"
                          className="wb-icon-btn"
                          style={{ width: 24, height: 24 }}
                        >
                          <InfoIcon />
                        </button>
                      ) : null}
                    </span>
                  </WbTd>
                  <WbTd nowrap muted>
                    <span className="wb-num">{new Date(r.charged_at).toISOString().slice(0, 10)}</span>
                  </WbTd>
                  <WbTd muted>
                    {r.isRecovery && r.reverses_charged_at
                      ? `Reverses your ${fmtShortDate(r.reverses_charged_at)} commission`
                      : "–"}
                  </WbTd>
                  <WbTd align="right" nowrap style={{ fontWeight: 600, color: r.isRecovery ? "var(--wb-red)" : undefined }}>
                    <span className="wb-num">{formatMoney(r.commission_cents, r.charge_currency)}</span>
                  </WbTd>
                </WbRow>
              );
            })}
          </tbody>
        </WbTable>
      )}

      {more > 0 ? <div className="wb-panel-foot">+ {more} more commissions</div> : null}

      <WbModal open={infoOpen} onClose={() => setInfoOpen(false)} title="A paid commission was refunded">
        <div className="wb-stack" style={{ fontSize: 14, lineHeight: 1.55, color: "var(--wb-ink-2)" }}>
          <p>
            A commission that was <strong style={{ color: "var(--wb-ink)" }}>already paid out</strong> to
            you was later refunded by the customer. Since the money was already sent, the amount is
            recovered from your <strong style={{ color: "var(--wb-ink)" }}>Available</strong> balance.
          </p>
          <p>
            Your original payout stays in your history, this line just balances it out. If a refund
            happens <em>before</em> a commission is paid, it simply shows as <em>Refunded</em> and
            never counts.
          </p>
          <div>
            <button type="button" onClick={() => setInfoOpen(false)} className="wb-btn-primary is-small">
              Got it
            </button>
          </div>
        </div>
      </WbModal>
    </>
  );
}

function InfoIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={16} x2={12} y2={12} />
      <line x1={12} y1={8} x2={12.01} y2={8} />
    </svg>
  );
}
