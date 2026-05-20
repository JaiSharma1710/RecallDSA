"use client";

import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/app/_components/charts/ChartCard";

export function DailySolveChart({
  data,
  average,
  title = "Daily Revisions",
}: {
  data: Array<{ date: string; count: number }>;
  average: number;
  title?: string;
}) {
  return (
    <ChartCard title={title}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), "MMM d")}
              tick={{ fontSize: 12, fill: "#64748b" }}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip labelFormatter={(value) => format(parseISO(value as string), "MMM d")} />
            <ReferenceLine
              y={average}
              stroke="#334155"
              strokeDasharray="4 4"
              label={{ value: "Avg", fill: "#334155", fontSize: 12 }}
            />
            <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#bfdbfe" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
