"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyPoint } from "@/lib/affiliate-activity";

/**
 * Tages-Trend-Chart (Area) fuers Affiliate-Dashboard. Generisch: eine Serie
 * (visitors | signups) aus der DailyPoint-Liste, eingefaerbt via `color`.
 * Optik + Achsen bewusst identisch zum Admin-DailyCallersChart, damit die
 * beiden Dashboards konsistent aussehen. Zwei Instanzen (Visitors/Sign-ups)
 * teilen sich diese Komponente — kein Copy-Paste pro Serie.
 */
export function DailyAreaChart({
  data,
  dataKey,
  color,
  name,
}: {
  data: DailyPoint[];
  dataKey: "visitors" | "signups";
  color: string;
  name: string;
}) {
  const gradId = `cd-aff-${dataKey}`;
  return (
    <div style={{ height: 200, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tick={{ fill: "#1a1d26", fillOpacity: 0.45, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: "#1a1d26", strokeOpacity: 0.15 }}
            contentStyle={{
              borderRadius: 10,
              border: "0.5px solid rgba(26,29,38,0.08)",
              fontSize: 12,
              boxShadow: "0 4px 16px rgba(8,10,20,0.06)",
            }}
            labelFormatter={(d) => d}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            name={name}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
