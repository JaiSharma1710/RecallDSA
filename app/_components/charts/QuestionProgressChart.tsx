"use client";

import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/app/_components/charts/ChartCard";

function formatDateLabel(value: string) {
  return format(parseISO(value), "MMM d");
}

export function QuestionProgressChart({
  title,
  data,
  dataKey,
  stroke,
}: {
  title: string;
  data: Array<{ date: string; [key: string]: number | string }>;
  dataKey: string;
  stroke: string;
}) {
  return (
    <ChartCard title={title}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 12, fill: "#64748b" }}
            />
            <YAxis allowDecimals={false} domain={[0, 5]} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip labelFormatter={(value) => formatDateLabel(String(value))} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
