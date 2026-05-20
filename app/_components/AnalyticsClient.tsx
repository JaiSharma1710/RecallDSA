"use client";

import { useEffect, useState } from "react";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { LoadingState } from "@/app/_components/LoadingState";
import { PageHeader } from "@/app/_components/PageHeader";
import { PlatformBadgeList } from "@/app/_components/PlatformBadgeList";
import { DailySolveChart } from "@/app/_components/charts/DailySolveChart";
import { HelpDependencyTrendChart } from "@/app/_components/charts/HelpDependencyTrendChart";
import { PlatformDistributionChart } from "@/app/_components/charts/PlatformDistributionChart";
import { RevisionHeatmap } from "@/app/_components/charts/RevisionHeatmap";
import { StatusDistributionChart } from "@/app/_components/charts/StatusDistributionChart";
import { TopicWeaknessChart } from "@/app/_components/charts/TopicWeaknessChart";

type AnalyticsResponse = {
  range: number;
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
  heatmap: Array<{ date: string; count: number; level: number }>;
  dailyRevisions: Array<{
    date: string;
    count: number;
    solvedWithoutHelp: number;
    neededHint: number;
    neededSolution: number;
  }>;
  topicWeakness: Array<{ topic: string; averageWeaknessScore: number; redOrangeCount: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  platformDistribution: Array<{ platform: string; questionCount: number; revisionCount: number }>;
  helpDependency: Array<{
    date: string;
    solvedWithoutHelp: number;
    neededHint: number;
    neededSolution: number;
  }>;
  weakestQuestions: Array<{
    questionId: string;
    name: string;
    topic: string;
    difficulty: string;
    weaknessScore: number;
    status: string;
    platforms: string[];
  }>;
  strongestImprovement: Array<{
    questionId: string;
    name: string;
    topic: string;
    confidenceDelta: number;
    difficultyDelta: number;
    timeDelta: number;
    platforms: string[];
  }>;
};

const ranges = [7, 30, 90, 365] as const;

export function AnalyticsClient() {
  const [range, setRange] = useState<(typeof ranges)[number]>(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetch(`/api/analytics/overview?range=${range}`);
        const analytics = (await response.json()) as AnalyticsResponse | { error: string };

        if (!response.ok || !("summary" in analytics)) {
          throw new Error("error" in analytics ? analytics.error : "Failed to load analytics.");
        }

        setData(analytics);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load analytics.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAnalytics();
  }, [range]);

  if (isLoading) {
    return <LoadingState label="Loading analytics" />;
  }

  if (error || !data) {
    return <EmptyState title="Could not load analytics" description={error} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Revision patterns, platform coverage, and progress trends across RecallDSA."
        actions={
          <div className="flex flex-wrap gap-2">
            {ranges.map((option) => (
              <Button
                key={option}
                type="button"
                variant={range === option ? "primary" : "secondary"}
                onClick={() => setRange(option)}
              >
                Last {option} days
              </Button>
            ))}
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total questions" value={data.summary.totalQuestions} />
        <MetricCard label="Total revisions" value={data.summary.totalRevisions} />
        <MetricCard label="Questions revised today" value={data.summary.revisedToday} />
        <MetricCard label="Current streak" value={data.summary.currentStreak} />
        <MetricCard label="Best streak" value={data.summary.bestStreak} />
        <MetricCard label="Average confidence" value={data.summary.averageConfidence.toFixed(1)} />
        <MetricCard
          label="Average weakness score"
          value={data.summary.averageWeaknessScore.toFixed(1)}
        />
        <MetricCard label="Daily average" value={data.summary.dailyAverage.toFixed(1)} />
        <MetricCard label="Weekly average" value={data.summary.weeklyAverage.toFixed(1)} />
        <MetricCard label="Monthly average" value={data.summary.monthlyAverage.toFixed(1)} />
        {data.summary.statusCounts.map((item) => (
          <MetricCard
            key={item.status}
            label={getStatusLabel(item.status as never)}
            value={item.count}
            status={item.status}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1.2fr]">
        <DailySolveChart
          data={data.dailyRevisions.map((item) => ({ date: item.date, count: item.count }))}
          average={data.summary.dailyAverage}
          title="Daily Solve Chart"
        />
        <RevisionHeatmap data={data.heatmap} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TopicWeaknessChart data={data.topicWeakness.slice(0, 8)} />
        <StatusDistributionChart data={data.statusDistribution} />
        <PlatformDistributionChart data={data.platformDistribution} />
        <HelpDependencyTrendChart data={data.helpDependency} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-950">Weakest Questions</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {data.weakestQuestions.map((question) => (
              <a
                key={question.questionId}
                href={`/questions/${question.questionId}`}
                className="flex flex-col gap-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{question.name}</p>
                    <p className="text-sm text-slate-500">
                      {question.topic} · {question.difficulty}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={question.status as never}>
                      {getStatusLabel(question.status as never)}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-950">
                      {Math.round(question.weaknessScore)}
                    </span>
                  </div>
                </div>
                <PlatformBadgeList platforms={question.platforms} />
              </a>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-950">Strongest Improvement</h2>
          {data.strongestImprovement.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Revise a few questions multiple times to unlock improvement insights.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {data.strongestImprovement.map((question) => (
                <a
                  key={question.questionId}
                  href={`/questions/${question.questionId}`}
                  className="block py-3"
                >
                  <p className="font-medium text-slate-950">{question.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {question.topic} · Confidence +{question.confidenceDelta} · Difficulty -
                    {question.difficultyDelta} · Time -{question.timeDelta} min
                  </p>
                  <div className="mt-2">
                    <PlatformBadgeList platforms={question.platforms} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number | string;
  status?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {status ? <Badge status={status as never}>{getStatusLabel(status as never)}</Badge> : null}
      </div>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </Card>
  );
}
