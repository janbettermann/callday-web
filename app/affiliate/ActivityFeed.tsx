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
 * (Zeitraum + Event-Typ). Jede Pille zeigt die aktuelle Auswahl + Chevron und
 * ploppt wie das Hamburger-Menü eine kleine Options-Card auf. Gefiltert wird
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

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#ffffff",
  border: "0.5px solid var(--line)",
  borderRadius: 100,
  padding: "7px 12px 7px 14px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--ink)",
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
};

/**
 * Filter-Pille + aufploppende Options-Card — gleiches Muster wie AffiliateNav
 * (Hamburger): unsichtbarer Fixed-Backdrop fängt den Außenklick, die Card liegt
 * darüber. Auswahl setzt den Wert und schließt.
 */
function FilterMenu<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={triggerStyle}
      >
        {current.label}
        <Chevron open={open} />
      </button>

      {open ? (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1 }}
          />
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 2,
              minWidth: 180,
              background: "#ffffff",
              border: "0.5px solid var(--line)",
              borderRadius: 14,
              boxShadow: "0 12px 32px rgba(26,29,38,0.12)",
              padding: 6,
            }}
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    width: "100%",
                    textAlign: "left",
                    background: active ? "rgba(26,29,38,0.045)" : "none",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--ink)",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.label}
                  {active ? <Check /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        color: "var(--ink-faint)",
        transition: "transform 0.18s ease",
        transform: open ? "rotate(180deg)" : "none",
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ color: "var(--blue-deep)", flexShrink: 0 }}
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
