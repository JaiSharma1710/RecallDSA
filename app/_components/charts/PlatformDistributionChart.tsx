"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/app/_components/charts/ChartCard";
import { getPlatformLabel } from "@/lib/platform";

export function PlatformDistributionChart({
  data,
}: {
  data: Array<{ platform: string; questionCount: number; revisionCount: number }>;
}) {
  const chartData = data.map((item) => ({
    ...item,
    label: getPlatformLabel(item.platform),
  }));

  return (
    <ChartCard title="Platform Distribution">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="questionCount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            <Bar dataKey="revisionCount" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
