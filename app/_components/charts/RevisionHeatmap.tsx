"use client";

import { format, parseISO } from "date-fns";

import { ChartCard } from "@/app/_components/charts/ChartCard";

const levelClasses = [
  "bg-slate-100",
  "bg-emerald-100",
  "bg-emerald-200",
  "bg-emerald-400",
  "bg-emerald-600",
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const VISIBLE_WEEKS = 17;

export function RevisionHeatmap({
  data,
}: {
  data: Array<{ date: string; count: number; revisionCount?: number; solvedCount?: number; level: number }>;
}) {
  const recentData = data.slice(-VISIBLE_WEEKS * 7);
  const totalActivity = data.reduce((sum, item) => sum + item.count, 0);
  const activeDays = data.filter((item) => item.count > 0).length;
  const busiestDay = data.reduce(
    (best, item) => (item.count > best.count ? item : best),
    data[0] ?? { date: "", count: 0, revisionCount: 0, solvedCount: 0, level: 0 },
  );
  const weekColumns = Array.from({ length: VISIBLE_WEEKS });
  const monthLabels = weekColumns.map((_, index) => {
    const item = recentData[index * 7];

    if (!item) {
      return "";
    }

    const currentMonth = format(parseISO(item.date), "MMM");
    const previousItem = recentData[(index - 1) * 7];
    const previousMonth = previousItem ? format(parseISO(previousItem.date), "MMM") : null;

    return currentMonth === previousMonth ? "" : currentMonth;
  });

  return (
    <ChartCard title="Activity Heatmap" description="Solved questions + revisions across the last 4 months">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Total activity
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">
              {totalActivity}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Active days
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">
              {activeDays}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Busiest day
            </p>
            <p className="mt-1.5 text-sm font-semibold text-slate-950">
              {busiestDay.date
                ? `${format(parseISO(busiestDay.date), "MMM d")} · ${busiestDay.count}`
                : "No data"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,1))] p-4">
          <div className="mb-3 grid grid-cols-[36px_repeat(17,minmax(0,1fr))] gap-2 text-[11px] font-medium text-slate-400">
            <div />
            {monthLabels.map((label, index) => (
              <div key={index} className="text-center">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[36px_repeat(17,minmax(0,1fr))] gap-2">
            {WEEKDAY_LABELS.map((label, rowIndex) => (
              <div key={label} className="contents">
                <div className="pr-2 text-xs font-medium text-slate-400">{label}</div>
                {weekColumns.map((_, columnIndex) => {
                  const item = recentData[columnIndex * 7 + rowIndex];

                  if (!item) {
                    return (
                      <div
                        key={`${label}-${columnIndex}`}
                        className="aspect-square rounded-[6px] bg-transparent"
                      />
                    );
                  }

                  return (
                    <div
                      key={item.date}
                      title={`${format(parseISO(item.date), "MMM d, yyyy")}: ${item.count} total (${item.revisionCount ?? 0} revisions, ${item.solvedCount ?? 0} solved)`}
                      className={`aspect-square min-h-4 min-w-4 rounded-[6px] ring-1 ring-inset ring-white/70 transition-transform hover:scale-105 ${
                        levelClasses[item.level] ?? levelClasses[0]
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-medium text-slate-400">Less</span>
            {levelClasses.map((levelClass, index) => (
              <span
                key={index}
                className={`inline-flex h-3.5 w-3.5 rounded-[4px] ${levelClass}`}
              />
            ))}
            <span className="font-medium text-slate-400">More</span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
