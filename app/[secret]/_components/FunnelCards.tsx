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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {STEPS.map((step, i) => {
        const value = data[step.key];
        const prev = i > 0 ? data[STEPS[i - 1].key] : null;
        const conv = prev !== null ? pct(value, prev) : null;
        return (
          <div
            key={step.key}
            style={{
              background: "#ffffff",
              border: "0.5px solid var(--line)",
              borderRadius: 16,
              padding: "16px 18px",
              boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                color: "var(--ink-faint)",
                fontWeight: 600,
              }}
            >
              {step.label}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: "-0.6px",
                  color: "var(--ink)",
                }}
              >
                {value}
              </span>
              {conv ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--green)",
                  }}
                >
                  {conv}
                </span>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "var(--ink-faint)",
              }}
            >
              {step.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
