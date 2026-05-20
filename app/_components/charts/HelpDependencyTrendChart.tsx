"use client";

import { format, parseISO } from "date-fns";
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

export function HelpDependencyTrendChart({
  data,
}: {
  data: Array<{
    date: string;
    solvedWithoutHelp: number;
    neededHint: number;
    neededSolution: number;
  }>;
}) {
  return (
    <ChartCard title="Help Dependency Trend">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), "MMM d")}
              tick={{ fontSize: 12, fill: "#64748b" }}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip labelFormatter={(value) => format(parseISO(value as string), "MMM d")} />
            <Legend />
            <Bar dataKey="solvedWithoutHelp" stackId="help" fill="#16a34a" />
            <Bar dataKey="neededHint" stackId="help" fill="#f59e0b" />
            <Bar dataKey="neededSolution" stackId="help" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
