"use client";

import type { DashboardCallday } from "@/lib/dashboard/data";
import { CalldaySticker, type CalldayPeriod } from "../components/CalldaySticker";
import { useStickerCopy } from "./use-sticker-copy";

/**
 * /calldays Card-View: die ganze Karte IST der Copy-Button (Jan-Wahl,
 * analog zur "Share your Callday"-Seite der App). Klick → Sticker-PNG in
 * die Zwischenablage → die Karte wird kurz gruen mit "Copied ✓".
 *
 * Copy-Logik + Capture-Quelle (off-screen Fixed-300px am exportRef) kommen
 * aus useStickerCopy — geteilt mit der List-Zeile (ShareableRow). Der gruene
 * Overlay wird erst nach dem Capture gerendert und liegt eh nicht im
 * Export-Node, landet also nie im Bild.
 */
export function ShareableSticker({
  day,
  period,
}: {
  day: DashboardCallday;
  period: CalldayPeriod;
}) {
  const { exportRef, status, copy } = useStickerCopy(day);

  return (
    <div
      className="callday-copycard"
      role="button"
      tabIndex={0}
      aria-label={`Copy ${day.label} sticker`}
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copy();
        }
      }}
    >
      {/* Sichtbare, responsive Karte (fuellt die Grid-Zelle). */}
      <CalldaySticker day={day} period={period} />

      {/* Off-screen Fixed-Width-Render — die eigentliche Export-Quelle. */}
      <div className="callday-export-stage" aria-hidden="true">
        <div ref={exportRef}>
          <CalldaySticker day={day} period={period} />
        </div>
      </div>

      {status === "copied" && (
        <div className="callday-copied" aria-hidden="true">
          <CheckIcon />
          Copied
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
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
