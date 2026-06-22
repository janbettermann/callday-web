import type { InactiveUserRow } from "@/lib/admin/queries";

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
  const styles =
    reason === "never_called"
      ? "bg-[#dc2626]/[0.08] text-[#dc2626]"
      : "bg-[#f59e0b]/12 text-[#b97e10]";
  const label = reason === "never_called" ? "Never called" : "Stalled";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles}`}
    >
      {label}
    </span>
  );
}

export function InactiveUsersTable({ rows }: { rows: InactiveUserRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1a1d26]/12 bg-white p-8 text-center text-sm text-[#1a1d26]/55">
        Everyone is active. Nice.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#1a1d26]/[0.06] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#faf9f5] text-left text-[11px] uppercase tracking-wider text-[#1a1d26]/45">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3 text-right">Calls</th>
            <th className="px-4 py-3">Last call</th>
            <th className="px-4 py-3 text-right">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a1d26]/[0.06]">
          {rows.map((r) => (
            <tr key={r.user_id} className="hover:bg-[#1a1d26]/[0.02]">
              <td className="px-4 py-3">
                {r.email ? (
                  <a
                    className="text-[#3564e0] hover:underline"
                    href={`mailto:${r.email}?subject=Hey from Callday`}
                  >
                    {r.email}
                  </a>
                ) : (
                  <span className="text-[#1a1d26]/35">no email</span>
                )}
                {r.name ? (
                  <div className="text-[11px] text-[#1a1d26]/45">{r.name}</div>
                ) : null}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <ReasonPill reason={r.reason} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.calls}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[#1a1d26]/65">
                {fmtDays(r.last_called_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-[#1a1d26]/55">
                {fmtDate(r.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
