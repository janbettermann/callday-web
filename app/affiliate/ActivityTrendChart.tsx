"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyPoint } from "@/lib/affiliate-activity";

export const TREND_COLORS = { visitors: "#3564e0", signups: "#2e9e5b" } as const;

// Rein optischer Versatz: haelt die Sign-ups-Linie am Nullpunkt sichtbar knapp
// ueber der Visitors-Linie (sonst verdeckt eine die andere, wenn beide 0 sind,
// aktuell an vielen Tagen). Auf aktiven Tagen (Werte 1+) faellt er nicht auf.
// Der Tooltip zeigt bewusst die ECHTEN Werte, nicht den versetzten.
const SIGNUP_OFFSET = 0.1;

interface Row extends DailyPoint {
  signupsPlot: number;
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: Row }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dfe2e6",
        borderRadius: 6,
        padding: "8px 11px",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color: TREND_COLORS.visitors }}>Visitors: {row.visitors}</div>
      <div style={{ color: TREND_COLORS.signups }}>Sign-ups: {row.signups}</div>
    </div>
  );
}

/**
 * Zwei-Linien-Trend (Visitors + Sign-ups) fuer die Activity-Seite. Beide
 * Serien auf einer Achse, damit man die Relation direkt sieht; ein
 * geteilter Tooltip zeigt beide Tageswerte (auch per Touch).
 */
export function ActivityTrendChart({ data }: { data: DailyPoint[] }) {
  const rows: Row[] = data.map((d) => ({
    ...d,
    signupsPlot: d.signups + SIGNUP_OFFSET,
  }));
  return (
    <div style={{ height: 220, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#1c1e21" strokeOpacity={0.06} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fill: "#1c1e21", fillOpacity: 0.45, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(2, Math.ceil(max))]}
            tick={{ fill: "#1c1e21", fillOpacity: 0.45, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#1c1e21", strokeOpacity: 0.15 }} />
          <Line type="monotone" dataKey="visitors" stroke={TREND_COLORS.visitors} strokeWidth={2} dot={false} name="Visitors" />
          <Line type="monotone" dataKey="signupsPlot" stroke={TREND_COLORS.signups} strokeWidth={2} dot={false} name="Sign-ups" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
