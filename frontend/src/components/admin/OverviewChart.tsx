"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export function OverviewChart({ data }: { data: { date: string; signups: number }[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#888", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#888", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8 }}
          labelStyle={{ color: "#ccc", fontSize: 12 }}
          itemStyle={{ color: "#F97316" }}
        />
        <Line
          type="monotone"
          dataKey="signups"
          stroke="#F97316"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#F97316" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
