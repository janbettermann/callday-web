import type { ActivityEvent } from "@/lib/affiliate-activity";
import { fmtRelative } from "@/lib/affiliate-activity";

/**
 * Activity-Feed (Visitors + Sign-ups) — geteilt von /affiliate/dashboard
 * (auf 10 gesliced) und /affiliate/activity (vollständig). Reines Rendering,
 * kein PII.
 */
export function ActivityList({ activity }: { activity: ActivityEvent[] }) {
  if (activity.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 14 }}>
        No activity yet. Share your link to get started.
      </p>
    );
  }

  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {activity.map((e, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderTop: i === 0 ? "none" : "0.5px solid var(--line)",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "var(--ink-dim)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <EventDot type={e.type} />
            <span style={{ whiteSpace: "nowrap" }}>{labelForEvent(e)}</span>
            {e.type === "view" && e.referrer_host ? (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.referrer_host}
              </span>
            ) : null}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--ink-faint)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {fmtRelative(e.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function labelForEvent(e: ActivityEvent): string {
  return e.type === "signup" ? "Sign-up" : "Visitor";
}

function EventDot({ type }: { type: ActivityEvent["type"] }) {
  const color =
    type === "signup"
      ? "var(--blue-deep, #2563e8)"
      : "var(--ink-faint, #94a3b8)";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 999,
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
