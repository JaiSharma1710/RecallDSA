"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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
    total: item.questionCount + item.revisionCount,
  }));

  return (
    <ChartCard
      title="Platform-wise Split"
      description="Combined question coverage and revision activity by platform."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData}>
              <PolarGrid stroke="#dbe4f0" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 12 }}
              />
              <Tooltip />
              <Radar
                name="Platform activity"
                dataKey="total"
                stroke="#6366f1"
                fill="#818cf8"
                fillOpacity={0.45}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {chartData.map((item) => (
            <div
              key={item.platform}
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-950">{item.label}</p>
                <p className="text-sm font-semibold text-slate-950">{item.total}</p>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {item.questionCount} questions · {item.revisionCount} revisions
              </p>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
