"use client";

import type { DashboardCallday } from "@/lib/dashboard/data";
import { CalldaySticker } from "../components/CalldaySticker";
import { useStickerCopy } from "./use-sticker-copy";

/**
 * /calldays Card-View: die ganze Karte IST der Copy-Button (Jan-Wahl,
 * analog zur "Share your Callday"-Seite der App). Klick → Sticker-PNG in
 * die Zwischenablage → die Karte zeigt kurz "✓ Copied".
 *
 * Der gruene Overlay ist IMMER im DOM (nur opacity/pointer-events schalten),
 * damit ein rasches Copy auf einer anderen Karte den Ausblende-Uebergang
 * hier nicht abschneidet — ohne Mount/Unmount kann CSS eine saubere
 * Ausblendung zeigen. Der Overlay liegt ausserhalb des Export-Nodes und
 * landet daher nie im Bild.
 */
export function ShareableSticker({ day }: { day: DashboardCallday }) {
  const { exportRef, status, copy } = useStickerCopy(day);
  const copied = status === "copied";

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
      <CalldaySticker day={day} />

      {/* Off-screen Fixed-Width-Render — die eigentliche Export-Quelle. */}
      <div className="callday-export-stage" aria-hidden="true">
        <div ref={exportRef}>
          <CalldaySticker day={day} />
        </div>
      </div>

      <div
        className={"callday-copied" + (copied ? " is-on" : "")}
        aria-hidden="true"
      >
        <CheckIcon />
        <span>Copied</span>
      </div>
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
