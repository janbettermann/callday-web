import type { TopUserRow } from "@/lib/admin/queries";
import {
  AdminEmptyState,
  AdminMailLink,
  AdminNumeric,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTRow,
} from "./admin-ui";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

const OUTCOME_LABEL: Record<string, string> = {
  meeting: "Meeting",
  callback: "Callback",
  not_reached: "Not reached",
  no_interest: "No interest",
  blocked: "Blocked",
  offer_sent: "Offer sent",
  won: "Won",
  voicemail: "Voicemail",
};

export function UserTable({ rows }: { rows: TopUserRow[] }) {
  if (rows.length === 0) {
    return <AdminEmptyState>No users yet.</AdminEmptyState>;
  }

  return (
    <AdminTable>
      <thead>
        <tr>
          <AdminTh>User</AdminTh>
          <AdminTh align="right">Lists</AdminTh>
          <AdminTh align="right">Calls</AdminTh>
          <AdminTh>Last call</AdminTh>
          <AdminTh>Top outcome</AdminTh>
          <AdminTh align="right">Joined</AdminTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <AdminTRow key={r.user_id}>
            <AdminTd>
              {r.email ? (
                <AdminMailLink email={r.email} />
              ) : (
                <span style={{ color: "var(--ink-mute)" }}>no email</span>
              )}
              {r.name ? (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-faint)",
                    marginTop: 2,
                  }}
                >
                  {r.name}
                </div>
              ) : null}
            </AdminTd>
            <AdminTd align="right">
              <AdminNumeric value={r.lists} />
            </AdminTd>
            <AdminTd align="right">
              <AdminNumeric value={r.calls} bold />
            </AdminTd>
            <AdminTd nowrap>{fmtDate(r.last_called_at)}</AdminTd>
            <AdminTd nowrap>
              {r.most_common_outcome
                ? OUTCOME_LABEL[r.most_common_outcome] ?? r.most_common_outcome
                : "—"}
            </AdminTd>
            <AdminTd align="right" nowrap muted>
              {fmtDate(r.created_at)}
            </AdminTd>
          </AdminTRow>
        ))}
      </tbody>
    </AdminTable>
  );
}
