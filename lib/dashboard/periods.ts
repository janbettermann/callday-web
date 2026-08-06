import type { DashboardCallday } from "./data";

/**
 * Aggregiert die Tages-Buckets (DashboardCallday[], UTC-gebucketed, siehe
 * data.ts) rein in Wochen- bzw. Monats-Buckets — kein extra Fetch. Ergebnis
 * ist wieder DashboardCallday-shaped (isoDate = Bucket-Start als React-Key +
 * Sort, label = Range/Monat), damit Sticker + List-Zeilen unveraendert
 * funktionieren. Alles UTC, konsistent mit `utcDay` in data.ts.
 */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Montag (UTC) der Woche, in der `iso` (YYYY-MM-DD) liegt. */
function mondayOf(iso: string): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=So .. 6=Sa
  const shift = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + shift);
  return d;
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "Aug 4–10" bzw. "Jul 28–Aug 3" (Mo–So der Woche). */
function weekRangeLabel(mon: Date): string {
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const m1 = MONTHS_SHORT[mon.getUTCMonth()];
  const m2 = MONTHS_SHORT[sun.getUTCMonth()];
  const d1 = mon.getUTCDate();
  const d2 = sun.getUTCDate();
  return mon.getUTCMonth() === sun.getUTCMonth()
    ? `${m1} ${d1}–${d2}`
    : `${m1} ${d1}–${m2} ${d2}`;
}

function sumInto(
  map: Map<string, { calls: number; meetings: number }>,
  key: string,
  day: DashboardCallday,
): void {
  const b = map.get(key) ?? { calls: 0, meetings: 0 };
  b.calls += day.calls;
  b.meetings += day.meetings;
  map.set(key, b);
}

/** Tages-Buckets → Wochen-Buckets (Mo–So, UTC), neueste zuerst. */
export function aggregateWeeks(days: DashboardCallday[]): DashboardCallday[] {
  const byWeek = new Map<string, { calls: number; meetings: number }>();
  for (const day of days) {
    sumInto(byWeek, isoOf(mondayOf(day.isoDate)), day);
  }
  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([iso, v]) => ({
      isoDate: iso,
      label: weekRangeLabel(new Date(`${iso}T00:00:00Z`)),
      calls: v.calls,
      meetings: v.meetings,
    }));
}

/**
 * Tages-Buckets → Monats-Buckets, neueste zuerst. Das Jahr steht nur im
 * Label, wenn es nicht das aktuelle ist ("August" vs "August 2025") — sonst
 * bliebe die Card unnoetig verbose.
 */
export function aggregateMonths(days: DashboardCallday[]): DashboardCallday[] {
  const byMonth = new Map<string, { calls: number; meetings: number }>();
  for (const day of days) {
    sumInto(byMonth, day.isoDate.slice(0, 7), day); // YYYY-MM
  }
  const currentYear = new Date().getUTCFullYear();
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, v]) => {
      const [y, m] = key.split("-").map((n) => parseInt(n, 10));
      const name = MONTHS_FULL[m - 1];
      return {
        isoDate: `${key}-01`,
        label: y === currentYear ? name : `${name} ${y}`,
        calls: v.calls,
        meetings: v.meetings,
      };
    });
}
