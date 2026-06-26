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

import type { DailyCallerPoint } from "@/lib/admin/queries";

function formatTick(d: string): string {
  // YYYY-MM-DD → MM-DD
  return d.slice(5);
}

export function DailyCallersChart({ data }: { data: DailyCallerPoint[] }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px solid var(--line)",
        borderRadius: 20,
        padding: 18,
        boxShadow: "0 1px 3px rgba(26,29,38,0.04)",
      }}
    >
      <div style={{ height: 240, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cd-callers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a7af7" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#4a7af7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#1a1d26"
              strokeOpacity={0.06}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
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
              dataKey="callers"
              stroke="#3564e0"
              strokeWidth={2}
              fill="url(#cd-callers)"
              name="Active callers"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
