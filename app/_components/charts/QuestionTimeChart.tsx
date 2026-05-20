"use client";

import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/app/_components/charts/ChartCard";

export function QuestionTimeChart({
  data,
}: {
  data: Array<{ date: string; timeTakenMinutes: number }>;
}) {
  return (
    <ChartCard title="Time Taken Over Time">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), "MMM d")}
              tick={{ fontSize: 12, fill: "#64748b" }}
            />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip labelFormatter={(value) => format(parseISO(value as string), "MMM d")} />
            <Bar dataKey="timeTakenMinutes" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
