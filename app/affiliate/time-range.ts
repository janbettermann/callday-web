/**
 * Zeitraum-Filter der Activity-Seite. Bewusst client-seitig gerechnet,
 * damit "Today" die lokale Zeitzone des Affiliates trifft (der Server
 * laeuft UTC), dieselbe Logik wie `PostList todayOnly`.
 */

export type TimeRange = "all" | "today" | "week" | "month";

export const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
];

/** Untere Zeitgrenze (ms) fuer den gewaehlten Zeitraum; 0 = kein Filter. */
export function timeFloor(range: TimeRange): number {
  if (range === "all") return 0;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  const days = range === "week" ? 7 : 30;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}
