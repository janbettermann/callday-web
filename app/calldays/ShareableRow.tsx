"use client";

import type { DashboardCallday } from "@/lib/dashboard/data";
import { CalldaySticker, type CalldayPeriod } from "../components/CalldaySticker";
import { useStickerCopy } from "./use-sticker-copy";

/**
 * /calldays List-View-Zeile mit Copy-Icon rechts (Jan-Wahl "Variante A"):
 * Klick aufs Icon → Sticker-PNG in die Zwischenablage → das Icon wird kurz
 * zum gruenen Haken. Kopiert dasselbe Bild wie der Card-View (geteiltes
 * useStickerCopy + off-screen Fixed-300px-Sticker als Capture-Quelle).
 */
export function ShareableRow({
  day,
  period,
}: {
  day: DashboardCallday;
  period: CalldayPeriod;
}) {
  const { exportRef, status, copy } = useStickerCopy(day);

  return (
    <div className="callday-row">
      <span className="callday-date">{day.label}</span>
      <span className="callday-stats">
        <b className="callday-num">{day.calls}</b>
        <span className="callday-lbl">
          {day.calls === 1 ? "call" : "calls"}
        </span>
        <b className={`callday-num${day.meetings === 0 ? " is-zero" : ""}`}>
          {day.meetings}
        </b>
        <span className="callday-lbl">
          {day.meetings === 1 ? "meeting" : "meetings"}
        </span>
      </span>

      <button
        type="button"
        className={`callday-row-copy${status === "copied" ? " is-copied" : ""}`}
        onClick={copy}
        disabled={status === "busy"}
        aria-label={status === "copied" ? "Copied" : `Copy ${day.label} sticker`}
      >
        {status === "copied" ? <CheckIcon /> : <CopyIcon />}
      </button>

      {/* Off-screen Fixed-Width-Render — die Export-Quelle fuer diese Zeile. */}
      <div className="callday-export-stage" aria-hidden="true">
        <div ref={exportRef}>
          <CalldaySticker day={day} period={period} />
        </div>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
