"use client";

import { useMemo, useState } from "react";

import type { ActivityEvent } from "@/lib/affiliate-activity";
import { ActivityList } from "./ActivityList";
import {
  FilterMenu,
  TIME_OPTIONS,
  timeFloor,
  type TimeRange,
} from "./FilterMenu";

type EventType = "all" | ActivityEvent["type"];

const EVENT_OPTIONS: { value: EventType; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "view", label: "Visitors" },
  { value: "signup", label: "Sign-ups" },
];

/**
 * /affiliate/activity — Client-Wrapper um ActivityList mit zwei Filter-Pillen
 * (Zeitraum + Event-Typ) aus der geteilten `FilterMenu`. Gefiltert wird
 * clientseitig auf der bereits geladenen Liste (kleines Volumen, kein
 * Server-Round-Trip). ActivityList bleibt rein präsentational.
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
        <FilterMenu options={TIME_OPTIONS} value={range} onChange={setRange} />
        <FilterMenu options={EVENT_OPTIONS} value={type} onChange={setType} />
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
