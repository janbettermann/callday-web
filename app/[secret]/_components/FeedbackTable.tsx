import type { FeedbackRow } from "@/lib/admin/queries";

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5`} className="text-[#fbbf24]">
      {"★".repeat(n)}
      <span className="text-[#1a1d26]/15">{"★".repeat(5 - n)}</span>
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
      <div className="rounded-xl border border-dashed border-[#1a1d26]/12 bg-white p-8 text-center text-sm text-[#1a1d26]/55">
        No feedback yet. Wait for the first beta tester to send something.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#1a1d26]/[0.06] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#faf9f5] text-left text-[11px] uppercase tracking-wider text-[#1a1d26]/45">
          <tr>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Feedback</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">App</th>
            <th className="px-4 py-3 text-right">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a1d26]/[0.06]">
          {rows.map((r) => (
            <tr key={r.id} className="align-top hover:bg-[#1a1d26]/[0.02]">
              <td className="px-4 py-3 whitespace-nowrap">
                <Stars n={r.rating} />
              </td>
              <td className="px-4 py-3 text-[#1a1d26]/85">
                {r.text ?? <span className="text-[#1a1d26]/35">—</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {r.email ? (
                  <a
                    className="text-[#3564e0] hover:underline"
                    href={`mailto:${r.email}?subject=Re: your Callday feedback`}
                  >
                    {r.email}
                  </a>
                ) : (
                  <span className="text-[#1a1d26]/35">anon</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[#1a1d26]/55">
                {r.app_version ?? "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-[#1a1d26]/55">
                {fmtWhen(r.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
