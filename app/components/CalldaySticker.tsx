import type { DashboardCallday } from "@/lib/dashboard/data";

/**
 * Callday-Sticker — Design aus der App (components/share/ShareCard.tsx,
 * light-Theme): zwei Stat-Zeilen (calls, meetings booked), darunter eine
 * Linie mit Datum unten links + callday.io unten rechts. Kein Name, kein
 * Wochentag (Redesign 2026-07-16). Geteilt von /dashboard (letzte drei)
 * und /calldays (volle Historie).
 */
export function CalldaySticker({ day }: { day: DashboardCallday }) {
  return (
    <div className="dash-sticker">
      <div className="dash-sticker-stats">
        <div className="dash-stat">
          <span className="dash-stat-num">{day.calls}</span>
          <span className="dash-stat-lbl">calls</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-num">{day.meetings}</span>
          <span className="dash-stat-lbl">meetings booked</span>
        </div>
      </div>
      <div className="dash-sticker-rule" />
      <div className="dash-sticker-foot">
        <span className="dash-sticker-date">{day.label}</span>
        <span className="dash-sticker-url">callday.io</span>
      </div>
    </div>
  );
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Muster-Sticker fuer den First-Run-Zustand (heutiges Datum, 0 calls) —
 * zeigt die Form, bevor der erste echte Callday existiert.
 */
export function EmptyCalldaySticker() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [, m, d] = todayIso.split("-").map((n) => parseInt(n, 10));

  return (
    <div className="dash-sticker is-empty">
      <div className="dash-sticker-stats">
        <div className="dash-stat">
          <span className="dash-stat-num">0</span>
          <span className="dash-stat-lbl">calls</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-num">0</span>
          <span className="dash-stat-lbl">meetings booked</span>
        </div>
      </div>
      <div className="dash-sticker-rule" />
      <div className="dash-sticker-foot">
        <span className="dash-sticker-date">
          {MONTHS[m - 1]} {d}
        </span>
        <span className="dash-sticker-url">callday.io</span>
      </div>
    </div>
  );
}
