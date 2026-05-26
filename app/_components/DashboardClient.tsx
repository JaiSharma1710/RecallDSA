"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/app/_components/Button";
import { EmptyState } from "@/app/_components/EmptyState";
import { LoadingState } from "@/app/_components/LoadingState";
import { PlatformBadgeList } from "@/app/_components/PlatformBadgeList";
import { DailySolveChart } from "@/app/_components/charts/DailySolveChart";
import { RevisionHeatmap } from "@/app/_components/charts/RevisionHeatmap";

type DashboardAnalytics = {
  summary: {
    totalQuestions: number;
    totalRevisions: number;
    revisedToday: number;
    currentStreak: number;
    bestStreak: number;
    notRevisedRecently: number;
    averageConfidence: number;
    averageWeaknessScore: number;
    statusCounts: Array<{ status: string; count: number }>;
    totalRevisionsInRange: number;
    dailyAverage: number;
    weeklyAverage: number;
    monthlyAverage: number;
  };
  dailyRevisions: Array<{ date: string; count: number }>;
  activityTimeline: Array<{
    date: string;
    count: number;
    revisionCount: number;
    solvedCount: number;
  }>;
  heatmap: Array<{
    date: string;
    count: number;
    revisionCount: number;
    solvedCount: number;
    level: number;
  }>;
  topicWeakness: Array<{
    topic: string;
    count: number;
    averageWeaknessScore: number;
    redOrangeCount: number;
  }>;
  platformDistribution: Array<{ platform: string; questionCount: number; revisionCount: number }>;
  weakestQuestions: Array<{
    questionId: string;
    name: string;
    topic: string;
    difficulty: string;
    weaknessScore: number;
    status: string;
    platforms: string[];
  }>;
};

type TrendView = "daily" | "weekly" | "monthly";

type DailyQuestion = {
  _id: string;
  completedToday: boolean;
};

type DailyResponse = {
  date: string;
  needsGeneration: boolean;
  canExtend: boolean;
  generatedCount: number;
  completedCount: number;
  remainingCount: number;
  questions: DailyQuestion[];
};

const statusOrder = ["Red", "Orange", "Yellow", "Green"] as const;

const statusMeta: Record<
  (typeof statusOrder)[number],
  { label: string; caption: string; tone: string; accent: string; icon: string }
> = {
  Red: {
    label: "Red Zone",
    caption: "Urgent revision",
    tone: "bg-red-50 text-red-600",
    accent: "from-red-500/15 to-red-100",
    icon: "◎",
  },
  Orange: {
    label: "Orange Zone",
    caption: "Needs attention",
    tone: "bg-orange-50 text-orange-600",
    accent: "from-orange-500/15 to-orange-100",
    icon: "!",
  },
  Yellow: {
    label: "Yellow Zone",
    caption: "Review soon",
    tone: "bg-amber-50 text-amber-600",
    accent: "from-amber-500/15 to-amber-100",
    icon: "◔",
  },
  Green: {
    label: "Green Zone",
    caption: "Strong memory",
    tone: "bg-emerald-50 text-emerald-600",
    accent: "from-emerald-500/15 to-emerald-100",
    icon: "✓",
  },
};

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatDecimal(value: number) {
  return value.toFixed(1);
}

function getStatusCount(statusCounts: DashboardAnalytics["summary"]["statusCounts"], status: string) {
  return statusCounts.find((item) => item.status === status)?.count ?? 0;
}

function getProgressMessage(completedToday: number, scheduledToday: number) {
  if (scheduledToday === 0) {
    return "Generate today’s revision queue to lock a stable focus set before you begin.";
  }

  if (completedToday >= scheduledToday) {
    return "Excellent work. Today’s full revision set is complete.";
  }

  return `${scheduledToday - completedToday} more revision${scheduledToday - completedToday === 1 ? "" : "s"} to wrap up today’s focus set.`;
}

function getRemainingToday(completedToday: number, scheduledToday: number) {
  return Math.max(scheduledToday - completedToday, 0);
}

async function postDailyGenerate() {
  const response = await fetch("/api/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate" }),
  });
  const data = (await response.json()) as DailyResponse | { error?: string; code?: string };

  if (!response.ok || !("date" in data)) {
    const error = "error" in data ? data.error ?? "Request failed." : "Request failed.";
    const code = "code" in data ? data.code : undefined;
    throw new Error(code ? `${code}::${error}` : error);
  }

  return data;
}

function parseActionError(message: string) {
  const [code, ...rest] = message.split("::");

  if (rest.length === 0) {
    return { code: "", message };
  }

  return { code, message: rest.join("::") };
}

function getTrendAverage(data: Array<{ count: number }>) {
  return data.reduce((sum, day) => sum + day.count, 0) / Math.max(data.length, 1);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getMonthStart(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function getMonthEnd(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1));
  nextMonth.setUTCDate(0);
  return nextMonth.toISOString().slice(0, 10);
}

function shiftMonth(dateKey: string, delta: number) {
  const [year, month] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return shifted.toISOString().slice(0, 10);
}

function sumActivityRange(
  lookup: Map<string, DashboardAnalytics["activityTimeline"][number]>,
  startDate: string,
  endDate: string,
) {
  let count = 0;
  let revisionCount = 0;
  let solvedCount = 0;
  let current = startDate;

  while (current <= endDate) {
    const item = lookup.get(current);
    count += item?.count ?? 0;
    revisionCount += item?.revisionCount ?? 0;
    solvedCount += item?.solvedCount ?? 0;
    current = addDays(current, 1);
  }

  return { count, revisionCount, solvedCount };
}

function getTrendConfig(view: TrendView) {
  if (view === "weekly") {
    return {
      label: "Last 4 weeks",
      description: "Weekly totals from solved questions and revisions.",
    };
  }

  if (view === "monthly") {
    return {
      label: "Last 6 months",
      description: "Monthly totals from solved questions and revisions.",
    };
  }

  return {
    label: "Last 7 days",
    description: "Daily totals from solved questions and revisions.",
  };
}

function buildTrendData(activityTimeline: DashboardAnalytics["activityTimeline"], view: TrendView) {
  if (activityTimeline.length === 0) {
    return [];
  }

  const latestDate = activityTimeline[activityTimeline.length - 1]?.date ?? "";
  const lookup = new Map(activityTimeline.map((item) => [item.date, item]));

  if (view === "daily") {
    return activityTimeline.slice(-7).map((item) => ({
      ...item,
      label: format(parseISO(item.date), "EEE"),
    }));
  }

  if (view === "weekly") {
    return Array.from({ length: 4 }, (_, index) => {
      const endDate = addDays(latestDate, -((3 - index) * 7));
      const startDate = addDays(endDate, -6);
      const totals = sumActivityRange(lookup, startDate, endDate);

      return {
        date: endDate,
        label: `W${index + 1}`,
        ...totals,
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = shiftMonth(latestDate, -(5 - index));
    const startDate = getMonthStart(monthDate);
    const endDate = getMonthEnd(monthDate);
    const totals = sumActivityRange(lookup, startDate, endDate);

    return {
      date: startDate,
      label: format(parseISO(startDate), "MMM"),
      ...totals,
    };
  });
}

function getPrimaryWeakQuestion(analytics: DashboardAnalytics) {
  return analytics.weakestQuestions[0] ?? null;
}

function getTopTopic(analytics: DashboardAnalytics) {
  return analytics.topicWeakness[0] ?? null;
}

function getTopPlatform(analytics: DashboardAnalytics) {
  return [...analytics.platformDistribution]
    .sort((a, b) => b.questionCount - a.questionCount || b.revisionCount - a.revisionCount)[0];
}

function getWeaknessLevel(score: number) {
  if (score >= 25) {
    return {
      label: "Critical attention",
      description: "This topic is currently in your red zone.",
      tone: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (score >= 16) {
    return {
      label: "Needs focus",
      description: "This topic is slipping and should be revised soon.",
      tone: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  if (score >= 8) {
    return {
      label: "Stable but watch it",
      description: "Memory is okay, but another pass would help.",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Healthy zone",
    description: "This topic is in a comfortable range right now.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function Sparkline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 44" className="h-10 w-24">
      <path
        d="M4 36h20l10-10 10 2 14-12 12 8 16-16 14 0 12-16"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function ProgressRing({ value }: { value: number }) {
  const safeValue = clampPercentage(value);

  return (
    <div
      className="grid h-20 w-20 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#4f86ff ${safeValue}%, rgba(79, 134, 255, 0.12) ${safeValue}% 100%)`,
      }}
    >
      <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-blue-600 shadow-inner">
        <CheckIcon />
      </div>
    </div>
  );
}

export function DashboardClient() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [trendView, setTrendView] = useState<TrendView>("daily");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    Promise.all([fetch("/api/analytics/overview?range=30"), fetch("/api/daily")])
      .then(async ([analyticsResponse, dailyResponse]) => {
        const analyticsData = (await analyticsResponse.json()) as
          | DashboardAnalytics
          | { error: string };
        const dailyData = (await dailyResponse.json()) as DailyResponse | { error: string };

        if (!analyticsResponse.ok || !("summary" in analyticsData)) {
          throw new Error(
            "error" in analyticsData ? analyticsData.error : "Failed to load dashboard.",
          );
        }

        if (!dailyResponse.ok || !("date" in dailyData)) {
          throw new Error("error" in dailyData ? dailyData.error : "Failed to load daily plan.");
        }

        if (!isCancelled) {
          setAnalytics(analyticsData);
          setDaily(dailyData);
        }
      })
      .catch((loadError) => {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleGenerateTodayQueue() {
    setIsGenerating(true);

    try {
      const nextDaily = await postDailyGenerate();
      setDaily(nextDaily);
      toast.success("Today’s revision queue is ready.");
    } catch (actionError) {
      const { code, message } = parseActionError(
        actionError instanceof Error ? actionError.message : "Request failed.",
      );

      if (code === "ALREADY_GENERATED") {
        toast("Today’s revision queue is already locked in.");
        const dailyResponse = await fetch("/api/daily");
        const nextDaily = (await dailyResponse.json()) as DailyResponse | { error: string };

        if (dailyResponse.ok && "date" in nextDaily) {
          setDaily(nextDaily);
        }
      } else {
        toast.error(message);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading dashboard" />;
  }

  if (error || !analytics) {
    return <EmptyState title="Could not load dashboard" description={error} />;
  }

  if (analytics.summary.totalQuestions === 0) {
    return (
      <div className="space-y-8">
        <HeroShell>
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Fresh Start
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Build your revision system before the backlog builds itself.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Add your solved DSA questions and this dashboard will turn them into a focused revision plan.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/questions" variant="secondary">
                Open question bank
              </Button>
            </div>
          </div>
        </HeroShell>
        <EmptyState
          title="No questions yet"
          description="Add your solved DSA questions to start building a revision queue."
        />
      </div>
    );
  }

  const scheduledToday = daily?.generatedCount ?? 0;
  const completedToday = daily?.completedCount ?? 0;
  const remainingToday = getRemainingToday(completedToday, scheduledToday);
  const completionPercentage =
    scheduledToday === 0 ? 0 : (completedToday / Math.max(scheduledToday, 1)) * 100;
  const weakestQuestion = getPrimaryWeakQuestion(analytics);
  const topTopic = getTopTopic(analytics);
  const topPlatform = getTopPlatform(analytics);
  const currentStreak = analytics.summary.currentStreak;
  const progressMessage = getProgressMessage(completedToday, scheduledToday);
  const priorityCounts = statusOrder.map((status) => ({
    status,
    count: getStatusCount(analytics.summary.statusCounts, status),
    ...statusMeta[status],
  }));
  const trendData = buildTrendData(analytics.activityTimeline, trendView);
  const trendConfig = getTrendConfig(trendView);

  return (
    <div className="space-y-5">
      <HeroShell>
        <section className="grid gap-5 xl:grid-cols-[1.55fr_0.9fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                Home Dashboard
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Welcome back. Ready to sharpen recall?
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-600">
                  {daily?.needsGeneration ? (
                    <>
                      Generate today’s revision queue once, lock your focus set, and work through it
                      without the list changing under you.
                    </>
                  ) : (
                    <>
                      You have <span className="font-semibold text-slate-950">{scheduledToday}</span> focused revision
                      {scheduledToday === 1 ? "" : "s"} queued for today, backed by a{" "}
                      <span className="font-semibold text-slate-950">{currentStreak}-day</span> consistency streak.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button href="/daily">Start Today’s Revision</Button>
              {daily?.needsGeneration ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleGenerateTodayQueue()}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Generate Today’s Queue"}
                </Button>
              ) : null}
            </div>
          </div>

          <section className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_80px_-34px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Today’s Revision Progress</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight text-slate-950">
                    {completedToday}
                  </span>
                  <span className="pb-1 text-xl text-slate-400">/ {scheduledToday}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {daily?.needsGeneration ? "Generate to begin" : "Completed"}
                </p>
              </div>
              <ProgressRing value={completionPercentage} />
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#4f86ff_0%,#7aa2ff_100%)] transition-all"
                style={{ width: `${clampPercentage(completionPercentage)}%` }}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{progressMessage}</p>
          </section>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricTile
            label="Revision Due"
            value={remainingToday}
            caption={
              scheduledToday === 0
                ? "nothing pending"
                : `${completedToday}/${scheduledToday} cleared so far`
            }
            icon={<CalendarIcon />}
            iconTone="from-blue-100 to-slate-50 text-blue-600"
            sparkColor="#2f6df6"
          />
          <MetricTile
            label="Avg Confidence"
            value={formatDecimal(analytics.summary.averageConfidence)}
            suffix="/ 5"
            caption="current recall confidence"
            icon={<ShieldIcon />}
            iconTone="from-emerald-100 to-slate-50 text-emerald-600"
            sparkColor="#22c55e"
          />
          <MetricTile
            label="Question Bank"
            value={analytics.summary.totalQuestions}
            caption="total questions"
            icon={<FolderIcon />}
            iconTone="from-violet-100 to-slate-50 text-violet-600"
            sparkColor="#8b5cf6"
          />
        </section>
      </HeroShell>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.95fr]">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-slate-950">Revision Priority</p>
              <p className="mt-1 text-sm text-slate-500">
                Focus on topics that need your attention the most.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Live status mix
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {priorityCounts.map((item) => (
              <div
                key={item.status}
                className={`rounded-[20px] border border-slate-200 bg-gradient-to-br ${item.accent} p-4`}
              >
                <div
                  className={`grid h-10 w-10 place-items-center rounded-xl text-lg font-semibold ${item.tone}`}
                >
                  {item.icon}
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                  {item.count}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="mt-1 text-sm text-slate-500">{item.caption}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-950">Recommended Next</p>
            <p className="text-sm text-slate-500">Smart suggestions to help you improve faster.</p>
          </div>

          <div className="mt-5 space-y-3">
            <RecommendationRow
              title={weakestQuestion ? `Revise ${weakestQuestion.name}` : "Review a weak question"}
              description={
                weakestQuestion
                  ? `${weakestQuestion.topic} is currently your weakest lane with a score of ${formatDecimal(weakestQuestion.weaknessScore)}.`
                  : "Start a revision session to strengthen your weak spots."
              }
              href={weakestQuestion ? `/questions/${weakestQuestion.questionId}` : "/daily"}
              cta={weakestQuestion ? "Review Now" : "Open Daily"}
              icon={<BookIcon />}
            />
            <RecommendationRow
              title={currentStreak > 0 ? "Maintain your streak" : "Start your streak"}
              description={
                currentStreak > 0
                  ? `You're on a ${currentStreak}-day run. One more focused session keeps it alive.`
                  : "A quick revision today puts your consistency streak in motion."
              }
              href="/daily"
              cta={currentStreak > 0 ? "Keep Going" : "Start Today"}
              icon={<FlameIcon />}
            />
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="overflow-hidden">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-slate-950">Revision Activity Trend</p>
              <p className="mt-1 text-sm text-slate-500">
                Switch between daily, weekly, and monthly totals.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-500">
              {(["daily", "weekly", "monthly"] as TrendView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setTrendView(view)}
                  className={`rounded-lg px-3 py-1.5 capitalize transition ${
                    trendView === view ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-700"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
          <DailySolveChart
            data={trendData}
            average={getTrendAverage(trendData)}
            title={trendConfig.label}
            description={trendConfig.description}
          />
        </Panel>
        <RevisionHeatmap data={analytics.heatmap} />
      </section>

      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-950">Weakest Topics</p>
            <p className="text-sm text-slate-500">
              Compact view of the topics with the highest weakness score.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 px-4 py-3 text-sm text-blue-700">
            {topTopic
              ? `Focus on ${topTopic.topic} next. It’s carrying the highest weakness score in your current bank.`
              : "Focus on weak topics to boost your overall performance."}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {analytics.topicWeakness.slice(0, 4).map((topic, index) => {
            const weaknessLevel = getWeaknessLevel(topic.averageWeaknessScore);
            const urgencyShare = topic.count === 0 ? 0 : Math.round((topic.redOrangeCount / topic.count) * 100);

            return (
              <div
                key={topic.topic}
                className="grid gap-4 rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-950">{topic.topic}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {topic.count} questions tracked
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Urgent</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {topic.redOrangeCount} need attention
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Weakness</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {formatDecimal(topic.averageWeaknessScore)} avg score
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Pressure</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{urgencyShare}% urgent</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${weaknessLevel.tone}`}
                  >
                    {weaknessLevel.label}
                  </span>
                  <Link
                    href={`/questions?topic=${encodeURIComponent(topic.topic)}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Practice
                    <ArrowRightIcon />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-950">Snapshot</p>
            <p className="mt-1 text-sm text-slate-500">A quick read of your revision system.</p>
          </div>
          {topPlatform ? (
            <div className="hidden sm:block">
              <PlatformBadgeList platforms={[topPlatform.platform]} />
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SnapshotStat
            label="Total Revisions"
            value={analytics.summary.totalRevisions}
            note={`${analytics.summary.totalRevisionsInRange} in the last 30 days`}
          />
          <SnapshotStat
            label="Daily Average"
            value={formatDecimal(analytics.summary.dailyAverage)}
            note="recent revision pace"
          />
          <SnapshotStat
            label="Best Streak"
            value={analytics.summary.bestStreak}
            note="days of consistency"
          />
          <SnapshotStat
            label="Weakest Score"
            value={formatDecimal(analytics.summary.averageWeaknessScore)}
            note="bank-wide average"
          />
        </div>
      </Panel>
    </div>
  );
}

function HeroShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.65),_rgba(255,255,255,0.96)_38%,_rgba(239,246,255,0.78)_100%)] p-5 shadow-[0_30px_100px_-44px_rgba(15,23,42,0.38)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),transparent_40%,rgba(191,219,254,0.24))]" />
      <div className="pointer-events-none absolute -left-14 top-12 h-44 w-44 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-60 w-60 rounded-full bg-sky-100/50 blur-3xl" />
      <div className="relative space-y-5">{children}</div>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] ${className}`}
    >
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  suffix,
  caption,
  icon,
  iconTone,
  sparkColor,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  caption: string;
  icon: ReactNode;
  iconTone: string;
  sparkColor: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${iconTone}`}>
          {icon}
        </div>
        <Sparkline color={sparkColor} />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        {suffix ? <span className="pb-1 text-lg text-slate-400">{suffix}</span> : null}
      </div>
      <p className="mt-1 text-sm text-slate-500">{caption}</p>
    </div>
  );
}

function RecommendationRow({
  title,
  description,
  href,
  cta,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-slate-950">{title}</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        {cta}
        <ArrowRightIcon />
      </Link>
    </div>
  );
}

function SnapshotStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function IconWrap({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-6 w-6 items-center justify-center">{children}</span>;
}

function CalendarIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
        <path d="M7 3.75v3.5M17 3.75v3.5M3.5 9.5h17" />
      </svg>
    </IconWrap>
  );
}

function ShieldIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M12 3.75 5.5 6.5v5.25c0 4.4 2.65 7.95 6.5 8.75 3.85-.8 6.5-4.35 6.5-8.75V6.5L12 3.75Z" />
        <path d="m9.5 12 1.7 1.7 3.3-3.45" />
      </svg>
    </IconWrap>
  );
}

function FolderIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2h6A2.5 2.5 0 0 1 20.5 9.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
      </svg>
    </IconWrap>
  );
}

function BookIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M6.5 5.5h9a2 2 0 0 1 2 2v11h-9a2 2 0 0 0-2 2V7.5a2 2 0 0 1 2-2Z" />
        <path d="M6.5 18.5h9M10 8.5h5" />
      </svg>
    </IconWrap>
  );
}

function FlameIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M12.5 3.5c1 3-1 4.5-2.5 6.5-1.4 1.8-2 3.1-2 4.8a4.5 4.5 0 1 0 9 0c0-2.3-1.15-4.05-2.85-5.9-.85-.95-1.65-2.15-1.65-5.4Z" />
      </svg>
    </IconWrap>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8">
      <path d="m7 12 3.25 3.25L17 8.5" />
    </svg>
  );
}
