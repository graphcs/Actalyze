"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

interface SparklineProps {
  data: { d: number; v: number }[];
  stroke?: string;
}

export default function Sparkline({ data, stroke = "#111827" }: SparklineProps) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="d" hide />
        <YAxis hide domain={[0, 100]} />
        <Tooltip
          contentStyle={{ borderRadius: 12, fontSize: 12 }}
          cursor={{ strokeDasharray: "3 3" }}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Generate sample sparkline data
export function generateSparkData(days: number = 14): { d: number; v: number }[] {
  return Array.from({ length: days }).map((_, i) => ({
    d: i + 1,
    v: Math.round(40 + Math.random() * 60),
  }));
}
