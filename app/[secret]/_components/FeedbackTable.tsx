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
        No feedback yet. Wait for the first beta tester to send something.
      </AdminEmptyState>
    );
  }

  return (
    <AdminTable>
      <thead>
        <tr>
          <AdminTh>Rating</AdminTh>
          <AdminTh>Feedback</AdminTh>
          <AdminTh>From</AdminTh>
          <AdminTh>App</AdminTh>
          <AdminTh align="right">When</AdminTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <AdminTRow key={r.id} align="top">
            <AdminTd nowrap>
              <Stars n={r.rating} />
            </AdminTd>
            <AdminTd style={{ color: "var(--ink)" }}>
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
              {r.app_version ?? "—"}
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
