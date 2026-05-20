"use client";

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

export function QuestionHelpChart({
  helpCounts,
}: {
  helpCounts: {
    solvedWithoutHelp: number;
    neededHint: number;
    neededSolution: number;
  };
}) {
  const data = [
    { name: "Without help", value: helpCounts.solvedWithoutHelp },
    { name: "Needed hint", value: helpCounts.neededHint },
    { name: "Needed solution", value: helpCounts.neededSolution },
  ];

  return (
    <ChartCard title="Help Dependency">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
