import type { TopUserRow } from "@/lib/admin/queries";

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
    return (
      <div className="rounded-xl border border-dashed border-[#1a1d26]/12 bg-white p-8 text-center text-sm text-[#1a1d26]/55">
        No users yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#1a1d26]/[0.06] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#faf9f5] text-left text-[11px] uppercase tracking-wider text-[#1a1d26]/45">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3 text-right">Lists</th>
            <th className="px-4 py-3 text-right">Calls</th>
            <th className="px-4 py-3">Last call</th>
            <th className="px-4 py-3">Top outcome</th>
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
                    href={`mailto:${r.email}`}
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
              <td className="px-4 py-3 text-right tabular-nums">{r.lists}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">
                {r.calls}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[#1a1d26]/65">
                {fmtDate(r.last_called_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[#1a1d26]/65">
                {r.most_common_outcome
                  ? OUTCOME_LABEL[r.most_common_outcome] ?? r.most_common_outcome
                  : "—"}
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
