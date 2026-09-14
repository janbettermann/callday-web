import type { FeedbackRow } from "@/lib/admin/queries";
import {
  AdminEmptyState,
  AdminMailLink,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTRow,
} from "./admin-ui";

function Stars({ n }: { n: number }) {
  return (
    <span
      aria-label={`${n} out of 5`}
      style={{
        color: "var(--sun)",
        letterSpacing: "1px",
      }}
    >
      {"★".repeat(n)}
      <span style={{ color: "var(--ink-mute)" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

/**
 * Typ-Zelle: Sterne nur bei echtem Rating (rating ist seit Migration 0050
 * nullable — Bug/Idea-Rows brachen hier vorher mit fuenf leeren Sternen),
 * sonst Kategorie-Badge.
 */
function TypeCell({ row }: { row: FeedbackRow }) {
  if (row.category === "rating" && row.rating != null) {
    return <Stars n={row.rating} />;
  }
  const isBug = row.category === "bug";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        background: isBug ? "rgba(178, 58, 58, 0.10)" : "rgba(74, 122, 247, 0.12)",
        color: isBug ? "#b23a3a" : "var(--blue-deep)",
      }}
    >
      {isBug ? "Bug" : row.category === "idea" ? "Idea" : "Rating"}
    </span>
  );
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const day = 86_400_000;
  if (diff < day) {
    const h = Math.floor(diff / 3_600_000);
    if (h === 0) {
      const m = Math.floor(diff / 60_000);
      return `${m}m ago`;
    }
    return `${h}h ago`;
  }
  return d.toISOString().slice(0, 10);
}

export function FeedbackTable({ rows }: { rows: FeedbackRow[] }) {
  if (rows.length === 0) {
    return (
      <AdminEmptyState>
        No feedback yet. Wait for the first user to send something.
      </AdminEmptyState>
    );
  }

  return (
    <AdminTable>
      <thead>
        <tr>
          <AdminTh>Type</AdminTh>
          <AdminTh>Feedback</AdminTh>
          <AdminTh>From</AdminTh>
          <AdminTh>Source</AdminTh>
          <AdminTh align="right">When</AdminTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <AdminTRow key={r.id} align="top">
            <AdminTd nowrap>
              <TypeCell row={r} />
            </AdminTd>
            <AdminTd style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
              {r.text ?? (
                <span style={{ color: "var(--ink-mute)" }}>—</span>
              )}
            </AdminTd>
            <AdminTd nowrap>
              {r.email ? (
                <AdminMailLink
                  email={r.email}
                  subject="Re: your Callday feedback"
                />
              ) : (
                <span style={{ color: "var(--ink-mute)" }}>anon</span>
              )}
            </AdminTd>
            <AdminTd mono nowrap>
              {r.source === "web_generator"
                ? "web generator"
                : (r.app_version ?? "app")}
            </AdminTd>
            <AdminTd align="right" nowrap muted>
              {fmtWhen(r.created_at)}
            </AdminTd>
          </AdminTRow>
        ))}
      </tbody>
    </AdminTable>
  );
}
