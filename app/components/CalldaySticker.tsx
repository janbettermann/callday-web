import type { DashboardCallday } from "@/lib/dashboard/data";

/**
 * Callday-Sticker — Design aus der App (components/share/ShareCard.tsx,
 * light-Theme): zwei Stat-Zeilen (calls, meetings booked), darunter eine
 * Linie mit Datum unten links + callday.io unten rechts. Kein Name, kein
 * Wochentag (Redesign 2026-07-16). Geteilt von /dashboard (letzte drei)
 * und /calldays (volle Historie).
 *
 * `period` = "day" (Default, kein Tag) | "week" (blau) | "month" (gold).
 * Bei week/month traegt der Sticker zusaetzlich ein Eck-Tag oben rechts
 * ("Variante C", 2026-08-06) — Layout sonst identisch; das `day.label`
 * traegt dann die Range ("Aug 4–10") bzw. den Monatsnamen ("August"). Die
 * Wochen-/Monats-Aggregation + der Days/Weeks/Months-Toggle + der
 * Share-Export sind der Post-Launch-Ausbau; dieser Sticker rendert den
 * Card-Teil davon schon fertig.
 */
export type CalldayPeriod = "day" | "week" | "month";

export function CalldaySticker({
  day,
  period = "day",
}: {
  day: DashboardCallday;
  period?: CalldayPeriod;
}) {
  return (
    <div className="dash-sticker">
      {period !== "day" && (
        <span className={`dash-sticker-tag dash-sticker-tag-${period}`}>
          {period === "week" ? "Week" : "Month"}
        </span>
      )}
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
