import type { FunnelMetrics } from "@/lib/admin/queries";

type Step = {
  key: keyof FunnelMetrics;
  label: string;
  sub: string;
};

const STEPS: Step[] = [
  { key: "applications", label: "Applications", sub: "Beta interest signals" },
  { key: "signups", label: "Sign-ups", sub: "Created an account" },
  { key: "withList", label: "Created list", sub: "Uploaded their own leads" },
  { key: "withFirstCall", label: "First call", sub: "Hit the call button once" },
  { key: "activeLast7Days", label: "Active 7d", sub: "Called in last 7 days" },
];

function pct(curr: number, prev: number): string | null {
  if (prev <= 0) return null;
  const v = Math.round((curr / prev) * 100);
  return `${v}%`;
}

export function FunnelCards({ data }: { data: FunnelMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {STEPS.map((step, i) => {
        const value = data[step.key];
        const prev = i > 0 ? data[STEPS[i - 1].key] : null;
        const conv = prev !== null ? pct(value, prev) : null;
        return (
          <div
            key={step.key}
            className="rounded-xl border border-[#1a1d26]/[0.06] bg-white p-4 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-[#1a1d26]/45">
              {step.label}
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-semibold tracking-tight">
                {value}
              </span>
              {conv ? (
                <span className="text-xs font-medium text-[#10b981]">
                  {conv}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-[#1a1d26]/50">
              {step.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
