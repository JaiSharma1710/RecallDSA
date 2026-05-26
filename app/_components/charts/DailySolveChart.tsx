"use client";

import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  description,
  title = "Daily Revisions",
}: {
  data: Array<{ date: string; count: number; label?: string; revisionCount?: number; solvedCount?: number }>;
  average: number;
  description?: string;
  title?: string;
}) {
  return (
    <ChartCard title={title} description={description}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value, index) =>
                data[index]?.label ?? format(parseISO(String(value)), "MMM d")
              }
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              labelFormatter={(value) => {
                const item = data.find((entry) => entry.date === value);

                if (!item) {
                  return String(value);
                }

                return item.label
                  ? `${item.label} (${format(parseISO(item.date), "MMM d")})`
                  : format(parseISO(item.date), "MMM d");
              }}
              formatter={(value, _name, payload) => {
                const item = payload.payload as {
                  count: number;
                  revisionCount?: number;
                  solvedCount?: number;
                };

                return [
                  `${value} total`,
                  item.revisionCount !== undefined || item.solvedCount !== undefined
                    ? `Revisions: ${item.revisionCount ?? 0} • New solved: ${item.solvedCount ?? 0}`
                    : "Activity",
                ];
              }}
            />
            <ReferenceLine
              y={average}
              stroke="#334155"
              strokeDasharray="4 4"
              label={{ value: "Avg", fill: "#334155", fontSize: 11 }}
            />
            <Bar dataKey="count" radius={[10, 10, 4, 4]} maxBarSize={40}>
              {data.map((item) => (
                <Cell
                  key={item.date}
                  fill={item.count === 0 ? "#dbeafe" : "#2563eb"}
                  fillOpacity={item.count === 0 ? 0.45 : 0.95}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
