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
  const totalRevisions = data.reduce((sum, item) => sum + item.count, 0);
  const activeDays = data.filter((item) => item.count > 0).length;
  const busiestDay = data.reduce(
    (best, item) => (item.count > best.count ? item : best),
    data[0] ?? { date: "", count: 0, level: 0 },
  );

  return (
    <ChartCard title="Revision Heatmap" description="Last 365 days">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Total revisions</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{totalRevisions}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Active days</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{activeDays}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Busiest day</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {busiestDay.date
                ? `${format(parseISO(busiestDay.date), "MMM d")} · ${busiestDay.count}`
                : "No data"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="mb-2 grid grid-cols-[auto_repeat(53,minmax(0,1fr))] gap-1 text-[11px] text-slate-500">
              <div />
              {Array.from({ length: 53 }).map((_, index) => (
                <div key={index} className="text-center">
                  {index % 4 === 0 && data[index * 7]
                    ? format(parseISO(data[index * 7].date), "MMM")
                    : ""}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[auto_repeat(53,minmax(0,1fr))] gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, rowIndex) => (
                <div key={label} className="contents">
                  <div className="pr-2 text-[11px] text-slate-500">{rowIndex % 2 === 0 ? label : ""}</div>
                  {Array.from({ length: 53 }).map((_, columnIndex) => {
                    const item = data[columnIndex * 7 + rowIndex];

                    if (!item) {
                      return <div key={`${label}-${columnIndex}`} className="aspect-square" />;
                    }

                    return (
                      <div
                        key={item.date}
                        title={`${format(parseISO(item.date), "MMM d, yyyy")}: ${item.count} revisions`}
                        className={`aspect-square rounded-[3px] ${levelClasses[item.level] ?? levelClasses[0]}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Less</span>
          {levelClasses.map((levelClass, index) => (
            <span
              key={index}
              className={`inline-flex h-3 w-3 rounded-[3px] ${levelClass}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </ChartCard>
  );
}
