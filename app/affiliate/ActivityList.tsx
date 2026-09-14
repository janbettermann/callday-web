import type { ActivityEvent } from "@/lib/affiliate-activity";
import { fmtRelative } from "@/lib/affiliate-activity";
import { WbDot, WbEmpty, WbRow, WbTable, WbTd, WbTh } from "@/app/components/werkbank";

/**
 * Activity-Feed (Visitors + Sign-ups) als Tabelle, geteilt von
 * /affiliate/dashboard (auf 5 gesliced) und /affiliate/activity
 * (vollstaendig, gefiltert). Reines Rendering, kein PII.
 */
export function ActivityList({
  activity,
  emptyText = "No activity yet. Share your link to get started.",
}: {
  activity: ActivityEvent[];
  emptyText?: string;
}) {
  if (activity.length === 0) {
    return <WbEmpty>{emptyText}</WbEmpty>;
  }

  return (
    <WbTable>
      <thead>
        <tr>
          <WbTh>Event</WbTh>
          <WbTh>Came from</WbTh>
          <WbTh align="right">When</WbTh>
        </tr>
      </thead>
      <tbody>
        {activity.map((e, i) => (
          <WbRow key={`${e.created_at}-${i}`}>
            <WbTd nowrap>
              <WbDot tone={e.type === "signup" ? "blue" : "gray"}>
                {e.type === "signup" ? "Sign-up" : "Visitor"}
              </WbDot>
            </WbTd>
            <WbTd muted>{e.type === "view" && e.referrer_host ? e.referrer_host : "–"}</WbTd>
            <WbTd align="right" nowrap muted>
              <span className="wb-num">{fmtRelative(e.created_at)}</span>
            </WbTd>
          </WbRow>
        ))}
      </tbody>
    </WbTable>
  );
}
