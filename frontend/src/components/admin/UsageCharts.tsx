"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export function GenerationsLineChart({ data }: { data: { date: string; generations: number }[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: "#888", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8 }}
          labelStyle={{ color: "#ccc", fontSize: 12 }}
          itemStyle={{ color: "#F97316" }}
        />
        <Line type="monotone" dataKey="generations" stroke="#F97316" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#F97316" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const STATUS_COLORS = ["#10b981", "#ef4444", "#888"];

export function StatusPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
          {data.map((_, i) => (
            <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8 }}
          itemStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SourcePieChart({ data }: { data: { source: string; count: number }[] }) {
  const COLORS = ["#F97316", "#fb923c", "#fdba74"];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count" nameKey="source">
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8 }}
          itemStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
