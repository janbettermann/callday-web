import type { FeedbackRow } from "@/lib/admin/dashboard-metrics";

import {
  WbBadge,
  WbEmpty,
  WbMailLink,
  WbTable,
  WbTd,
  WbTh,
  WbRow,
} from "./admin-ui";

const STAR_PATH =
  "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z";

function Stars({ n }: { n: number }) {
  return (
    <span
      style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}
      role="img"
      aria-label={`${n} von 5 Sternen`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR_PATH} fill={i < n ? "#e0a526" : "#dfe2e6"} />
        </svg>
      ))}
    </span>
  );
}

/**
 * Typ-Zelle: Sterne nur bei echtem Rating (rating ist seit Migration 0050
 * nullable), sonst Kategorie-Badge. Bug bewusst grau statt rot, das ist
 * eine Meldung, kein Alarm.
 */
function TypeCell({ row }: { row: FeedbackRow }) {
  if (row.category === "rating" && row.rating != null) {
    return <Stars n={row.rating} />;
  }
  if (row.category === "idea") return <WbBadge tone="blue">Idee</WbBadge>;
  if (row.category === "bug") return <WbBadge>Bug</WbBadge>;
  return <WbBadge>Rating</WbBadge>;
}

function fmtWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day) {
    const h = Math.floor(diff / 3_600_000);
    if (h === 0) return `vor ${Math.floor(diff / 60_000)} min`;
    return `vor ${h} h`;
  }
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export function FeedbackTable({ rows }: { rows: FeedbackRow[] }) {
  if (rows.length === 0) {
    return <WbEmpty>Noch kein Feedback mit Text.</WbEmpty>;
  }

  return (
    <WbTable>
      <thead>
        <tr>
          <WbTh width={110}>Typ</WbTh>
          <WbTh>Feedback</WbTh>
          <WbTh width={240}>Von</WbTh>
          <WbTh width={120}>Quelle</WbTh>
          <WbTh align="right" width={100}>
            Wann
          </WbTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <WbRow key={r.id} align="top">
            <WbTd nowrap>
              <TypeCell row={r} />
            </WbTd>
            <WbTd wrap>{r.text}</WbTd>
            <WbTd nowrap>
              {r.email ? (
                <WbMailLink email={r.email} subject="Re: dein Callday-Feedback" />
              ) : (
                <span className="is-faint">anonym</span>
              )}
            </WbTd>
            <WbTd nowrap muted>
              {r.source === "web_generator" ? "Web-Generator" : `App ${r.app_version ?? ""}`.trim()}
            </WbTd>
            <WbTd align="right" nowrap muted>
              {fmtWhen(r.created_at)}
            </WbTd>
          </WbRow>
        ))}
      </tbody>
    </WbTable>
  );
}
