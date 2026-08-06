"use client";

import { useMemo, useState } from "react";
import type { DashboardCallday } from "@/lib/dashboard/data";
import { aggregateMonths, aggregateWeeks } from "@/lib/dashboard/periods";
import type { CalldayPeriod } from "../components/CalldaySticker";
import { ShareableSticker } from "./ShareableSticker";
import { ShareableRow } from "./ShareableRow";

/**
 * /calldays — Zeit-Granularitaet (Days/Weeks/Months) × View (Card/List).
 * Nur hier, NICHT auf dem Dashboard.
 *
 * Tage kommen server-seitig als DashboardCallday[]; Wochen/Monate werden
 * hier per useMemo rein daraus aggregiert (kein extra Fetch, siehe
 * lib/dashboard/periods.ts). Card-View = Sticker-Grid (Tag/Woche/Monat je
 * mit Eck-Tag), List-View = Zeilen. Beide Toggles sitzen rechts im Header;
 * Default = Days + Card (bisheriger Stand).
 */
type View = "card" | "list";

export function CalldaysView({ calldays }: { calldays: DashboardCallday[] }) {
  const [period, setPeriod] = useState<CalldayPeriod>("day");
  const [view, setView] = useState<View>("card");

  const weeks = useMemo(() => aggregateWeeks(calldays), [calldays]);
  const months = useMemo(() => aggregateMonths(calldays), [calldays]);
  const items =
    period === "day" ? calldays : period === "week" ? weeks : months;

  return (
    <>
      <div className="dash-head calldays-head">
        <h1 className="dash-greet">Your Calldays</h1>
        <div className="calldays-controls">
          <PeriodToggle period={period} onChange={setPeriod} />
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {view === "card" ? (
        <div className="dash-duo">
          {items.map((item) => (
            <ShareableSticker key={item.isoDate} day={item} period={period} />
          ))}
        </div>
      ) : (
        <div className="callday-list">
          {items.map((item) => (
            <ShareableRow key={item.isoDate} day={item} period={period} />
          ))}
        </div>
      )}
    </>
  );
}

const PERIODS: { value: CalldayPeriod; label: string }[] = [
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "month", label: "Months" },
];

/* Zeit-Granularitaet — Text-Segmented-Control (Days/Weeks/Months). */
function PeriodToggle({
  period,
  onChange,
}: {
  period: CalldayPeriod;
  onChange: (p: CalldayPeriod) => void;
}) {
  return (
    <div className="cd-segtoggle" role="group" aria-label="Group by">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          className={`cd-seg-btn${period === p.value ? " is-active" : ""}`}
          aria-pressed={period === p.value}
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* Card/List — Icon-Segmented-Control, 1:1 aus der App (ControlBar.tsx). */
function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="cd-viewtoggle" role="group" aria-label="Switch view">
      <button
        type="button"
        className={`cd-vt-btn${view === "card" ? " is-active" : ""}`}
        aria-pressed={view === "card"}
        aria-label="Card view"
        onClick={() => onChange("card")}
      >
        <CardIcon />
      </button>
      <button
        type="button"
        className={`cd-vt-btn${view === "list" ? " is-active" : ""}`}
        aria-pressed={view === "list"}
        aria-label="List view"
        onClick={() => onChange("list")}
      >
        <ListIcon />
      </button>
    </div>
  );
}

/* Card-Glyph (Rechteck + obere Trennlinie) — aus der App. */
function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* List-Glyph (drei Zeilen mit fuehrenden Punkten) — aus der App. */
function ListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
