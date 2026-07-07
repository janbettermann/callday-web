"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import type { ActivityEvent } from "@/lib/affiliate-activity";
import { ActivityList } from "./ActivityList";

type TimeRange = "all" | "today" | "week" | "month";
type EventType = "all" | ActivityEvent["type"];

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
];

const EVENT_OPTIONS: { value: EventType; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "view", label: "Visitors" },
  { value: "signup", label: "Sign-ups" },
];

/**
 * Untere Zeitgrenze (ms) für den gewählten Zeitraum; 0 = kein Filter. Bewusst
 * client-seitig gerechnet, damit „Today" die lokale Zeitzone des Affiliates
 * trifft (der Server läuft UTC) — dieselbe Logik wie `PostList todayOnly`.
 */
function timeFloor(range: TimeRange): number {
  if (range === "all") return 0;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  const days = range === "week" ? 7 : 30;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

/**
 * /affiliate/activity — Client-Wrapper um ActivityList mit zwei Filter-Pillen
 * (Zeitraum + Event-Typ). Filtert die bereits geladene Liste im Browser (kleines
 * Volumen, kein Server-Round-Trip). ActivityList bleibt rein präsentational.
 */
export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  const [range, setRange] = useState<TimeRange>("all");
  const [type, setType] = useState<EventType>("all");

  const filtered = useMemo(() => {
    const floor = timeFloor(range);
    return activity.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (floor > 0 && new Date(e.created_at).getTime() < floor) return false;
      return true;
    });
  }, [activity, range, type]);

  return (
    <>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}
      >
        <Segmented options={TIME_OPTIONS} value={range} onChange={setRange} />
        <Segmented options={EVENT_OPTIONS} value={type} onChange={setType} />
      </div>

      {filtered.length === 0 && activity.length > 0 ? (
        <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 14 }}>
          No activity in this range.
        </p>
      ) : (
        <ActivityList activity={filtered} />
      )}
    </>
  );
}

const pillBase: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/**
 * Segmented-Pill-Gruppe (weiße Box, aktive Pille dunkel gefüllt) — gleiche
 * Optik wie der Admin-StatusFilter. `flexWrap`, damit die Box auf schmalen
 * Screens intern umbricht statt zu überlaufen.
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        gap: 2,
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 14,
        padding: 4,
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              ...pillBase,
              background: active ? "var(--ink)" : "transparent",
              color: active ? "#ffffff" : "var(--ink-dim)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
