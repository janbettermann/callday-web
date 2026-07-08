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

const VISITORS = "#3564e0";
const SIGNUPS = "#059669";

// Rein optischer Versatz: haelt die Sign-ups-Linie am Nullpunkt sichtbar knapp
// ueber der Visitors-Linie (sonst verdeckt eine die andere, wenn beide 0 sind —
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
        borderRadius: 10,
        border: "0.5px solid rgba(26,29,38,0.08)",
        boxShadow: "0 4px 16px rgba(8,10,20,0.06)",
        padding: "8px 11px",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ color: "var(--ink)", fontWeight: 600, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ color: VISITORS }}>Visitors: {row.visitors}</div>
      <div style={{ color: SIGNUPS }}>Sign-ups: {row.signups}</div>
    </div>
  );
}

/**
 * Zwei-Linien-Trend (Visitors + Sign-ups) fuer die Link-Activity-Seite. Beide
 * Serien ueberlagert auf einer Achse, damit man die Relation direkt sieht; ein
 * geteilter Tooltip zeigt beide Tageswerte (auch per Touch/Finger). Bewusst
 * OHNE Flaechen-Fuellung — nur die Linie. Weiche Kurve (monotone) wie zuvor.
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
          <CartesianGrid stroke="#1a1d26" strokeOpacity={0.06} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fill: "#1a1d26", fillOpacity: 0.45, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(2, Math.ceil(max))]}
            tick={{ fill: "#1a1d26", fillOpacity: 0.45, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "#1a1d26", strokeOpacity: 0.15 }}
          />
          <Line
            type="monotone"
            dataKey="visitors"
            stroke={VISITORS}
            strokeWidth={2}
            dot={false}
            name="Visitors"
          />
          <Line
            type="monotone"
            dataKey="signupsPlot"
            stroke={SIGNUPS}
            strokeWidth={2}
            dot={false}
            name="Sign-ups"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
