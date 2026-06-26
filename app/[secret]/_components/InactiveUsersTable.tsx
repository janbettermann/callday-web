import type { InactiveUserRow } from "@/lib/admin/queries";
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

function fmtDays(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function ReasonPill({ reason }: { reason: InactiveUserRow["reason"] }) {
  const isNever = reason === "never_called";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        background: isNever
          ? "rgba(220,38,38,0.08)"
          : "rgba(245,158,11,0.15)",
        color: isNever ? "#b91c1c" : "var(--sun-deep)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: "currentColor",
        }}
      />
      {isNever ? "Never called" : "Stalled"}
    </span>
  );
}

export function InactiveUsersTable({ rows }: { rows: InactiveUserRow[] }) {
  if (rows.length === 0) {
    return <AdminEmptyState>Everyone is active. Nice.</AdminEmptyState>;
  }

  return (
    <AdminTable>
      <thead>
        <tr>
          <AdminTh>User</AdminTh>
          <AdminTh>Reason</AdminTh>
          <AdminTh align="right">Calls</AdminTh>
          <AdminTh>Last call</AdminTh>
          <AdminTh align="right">Joined</AdminTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <AdminTRow key={r.user_id}>
            <AdminTd>
              {r.email ? (
                <AdminMailLink email={r.email} subject="Hey from Callday" />
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
            <AdminTd nowrap>
              <ReasonPill reason={r.reason} />
            </AdminTd>
            <AdminTd align="right">
              <AdminNumeric value={r.calls} />
            </AdminTd>
            <AdminTd nowrap>{fmtDays(r.last_called_at)}</AdminTd>
            <AdminTd align="right" nowrap muted>
              {fmtDate(r.created_at)}
            </AdminTd>
          </AdminTRow>
        ))}
      </tbody>
    </AdminTable>
  );
}
