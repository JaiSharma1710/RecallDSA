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

type DashboardAnalytics = {
  summary: {
    totalQuestions: number;
    totalRevisions: number;
    revisedToday: number;
    notRevisedRecently: number;
    averageConfidence: number;
    statusCounts: Array<{ status: string; count: number }>;
  };
  dailyRevisions: Array<{ date: string; count: number }>;
  topicWeakness: Array<{ topic: string; count: number; averageWeaknessScore: number }>;
  platformDistribution: Array<{ platform: string; questionCount: number; revisionCount: number }>;
  weakestQuestions: Array<{
    questionId: string;
    name: string;
    topic: string;
    weaknessScore: number;
    status: string;
    platforms: string[];
  }>;
};

export function DashboardClient() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/analytics/overview?range=7");
        const data = (await response.json()) as DashboardAnalytics | { error: string };

        if (!response.ok || !("summary" in data)) {
          throw new Error("error" in data ? data.error : "Failed to load dashboard.");
        }

        setAnalytics(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (isLoading) {
    return <LoadingState label="Loading dashboard" />;
  }

  if (error || !analytics) {
    return <EmptyState title="Could not load dashboard" description={error} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="RecallDSA"
        description="Revise smarter. Remember longer."
        actions={
          <>
            <Button href="/daily">Open Daily 5</Button>
            <Button href="/analytics" variant="secondary">
              Open Analytics
            </Button>
            <Button href="/questions/new" variant="secondary">
              Add question
            </Button>
          </>
        }
      />

      {analytics.summary.totalQuestions === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Add your solved DSA questions to start building a revision queue."
          action={<Button href="/questions/new">Add first question</Button>}
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Today's revisions" value={analytics.summary.revisedToday} />
            <MetricCard label="Total questions" value={analytics.summary.totalQuestions} />
            <MetricCard label="Total revisions" value={analytics.summary.totalRevisions} />
            <MetricCard
              label="Not revised recently"
              value={analytics.summary.notRevisedRecently}
            />
            <MetricCard
              label="Average confidence"
              value={analytics.summary.averageConfidence.toFixed(1)}
            />
            {analytics.summary.statusCounts.map((item) => (
                <MetricCard
                  key={item.status}
                  label={getStatusLabel(item.status as never)}
                  value={item.count}
                  status={item.status}
                />
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <DailySolveChart
              data={analytics.dailyRevisions}
              average={
                analytics.dailyRevisions.reduce((sum, day) => sum + day.count, 0) /
                Math.max(analytics.dailyRevisions.length, 1)
              }
              title="Last 7 Days"
            />
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-950">Top weak topics</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {analytics.topicWeakness.slice(0, 5).map((item) => (
                  <div key={item.topic} className="grid gap-3 py-3 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <p className="font-medium text-slate-950">{item.topic}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.count} questions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Avg score</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {item.averageWeaknessScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-950">Platform distribution</h2>
              <div className="mt-4 space-y-3">
                {analytics.platformDistribution.map((item) => (
                  <div key={item.platform} className="flex items-center justify-between gap-3">
                    <PlatformBadgeList platforms={[item.platform]} />
                    <p className="text-sm text-slate-500">
                      {item.questionCount} questions · {item.revisionCount} revisions
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-950">Top 5 weakest questions</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {analytics.weakestQuestions.slice(0, 5).map((question) => (
                  <a
                    key={question.questionId}
                    href={`/questions/${question.questionId}`}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{question.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{question.topic}</p>
                      <div className="mt-2">
                        <PlatformBadgeList platforms={question.platforms} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge status={question.status as never}>
                        {getStatusLabel(question.status as never)}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-950">
                        {Math.round(question.weaknessScore)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
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
