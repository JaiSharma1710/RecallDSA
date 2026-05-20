"use client";

import { format, parseISO } from "date-fns";

import { ChartCard } from "@/app/_components/charts/ChartCard";

const levelClasses = [
  "bg-slate-100",
  "bg-emerald-200",
  "bg-emerald-400",
  "bg-emerald-600",
];

export function RevisionHeatmap({
  data,
}: {
  data: Array<{ date: string; count: number; level: number }>;
}) {
  return (
    <ChartCard title="Revision Heatmap" description="Last 365 days">
      <div className="grid grid-cols-13 gap-1 sm:grid-cols-[repeat(26,minmax(0,1fr))] lg:grid-cols-[repeat(53,minmax(0,1fr))]">
        {data.map((item) => (
          <div
            key={item.date}
            title={`${format(parseISO(item.date), "MMM d, yyyy")}: ${item.count} revisions`}
            className={`aspect-square rounded-sm ${levelClasses[item.level] ?? levelClasses[0]}`}
          />
        ))}
      </div>
    </ChartCard>
  );
}
