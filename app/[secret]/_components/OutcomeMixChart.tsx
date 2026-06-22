"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { OutcomeMixPoint } from "@/lib/admin/queries";

type Series = { key: keyof OutcomeMixPoint; label: string; color: string };

const SERIES: Series[] = [
  { key: "meeting", label: "Meeting", color: "#10b981" },
  { key: "callback", label: "Callback", color: "#fbbf24" },
  { key: "not_reached", label: "Not reached", color: "#1a1d26" },
  { key: "no_interest", label: "No interest", color: "#dc2626" },
  { key: "blocked", label: "Blocked", color: "#7a8499" },
];

function formatTick(d: string): string {
  return d.slice(5);
}

export function OutcomeMixChart({ data }: { data: OutcomeMixPoint[] }) {
  return (
    <div className="rounded-xl border border-[#1a1d26]/[0.06] bg-white p-4 shadow-sm">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
          >
            <CartesianGrid stroke="#1a1d26" strokeOpacity={0.06} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              tick={{ fill: "#1a1d26", fillOpacity: 0.5, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#1a1d26", fillOpacity: 0.5, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "#1a1d26", fillOpacity: 0.04 }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid rgba(26,29,38,0.08)",
                fontSize: 12,
                boxShadow: "0 4px 16px rgba(8,10,20,0.06)",
              }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key as string}
                dataKey={s.key as string}
                name={s.label}
                stackId="o"
                fill={s.color}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
