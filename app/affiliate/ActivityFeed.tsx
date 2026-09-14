"use client";

import { useMemo, useState } from "react";

import type { ActivityEvent } from "@/lib/affiliate-activity";
import { ActivityList } from "./ActivityList";
import { SegmentedButtons } from "./SegmentedButtons";
import { TIME_OPTIONS, timeFloor, type TimeRange } from "./time-range";

type EventType = "all" | ActivityEvent["type"];

const EVENT_OPTIONS: { value: EventType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "view", label: "Visitors" },
  { value: "signup", label: "Sign-ups" },
];

/**
 * /affiliate/activity: Werkzeugleiste mit zwei Segment-Schaltern
 * (Zeitraum + Ereignis-Typ) ueber der Tabelle. Gefiltert wird
 * clientseitig auf der bereits geladenen Liste (kleines Volumen).
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
      <div className="wb-toolbar" style={{ flexWrap: "wrap" }}>
        <SegmentedButtons options={TIME_OPTIONS} value={range} onChange={setRange} label="Time range" />
        <SegmentedButtons options={EVENT_OPTIONS} value={type} onChange={setType} label="Event type" />
        <span style={{ fontSize: 12, color: "var(--wb-ink-3)", marginLeft: "auto" }}>
          {filtered.length} of {activity.length}
        </span>
      </div>
      <ActivityList
        activity={filtered}
        emptyText={activity.length > 0 ? "No activity in this range." : undefined}
      />
    </>
  );
}
