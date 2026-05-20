"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "@/app/_components/charts/ChartCard";
import { getStatusLabel } from "@/app/_components/Badge";

const statusColors: Record<string, string> = {
  Red: "#dc2626",
  Orange: "#f97316",
  Yellow: "#eab308",
  Green: "#16a34a",
};

export function StatusDistributionChart({
  data,
}: {
  data: Array<{ status: string; count: number }>;
}) {
  const chartData = data.map((item) => ({
    ...item,
    label: getStatusLabel(item.status as never),
  }));

  return (
    <ChartCard title="Status Distribution">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="count" nameKey="label" innerRadius={60} outerRadius={100}>
              {chartData.map((item) => (
                <Cell key={item.status} fill={statusColors[item.status] ?? "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
