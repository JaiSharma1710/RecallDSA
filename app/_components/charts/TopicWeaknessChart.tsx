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

import { ChartCard } from "@/app/_components/charts/ChartCard";

export function TopicWeaknessChart({
  data,
}: {
  data: Array<{ topic: string; averageWeaknessScore: number; redOrangeCount: number }>;
}) {
  return (
    <ChartCard title="Topic Weakness">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="topic" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="averageWeaknessScore" fill="#f97316" radius={[6, 6, 0, 0]} />
            <Bar dataKey="redOrangeCount" fill="#dc2626" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
