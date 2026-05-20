"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { LoadingState } from "@/app/_components/LoadingState";
import { PageHeader } from "@/app/_components/PageHeader";
import type { Question, QuestionStatus } from "@/app/_types/question";

type QuestionsResponse = {
  questions: Question[];
};

const statuses: QuestionStatus[] = ["Red", "Orange", "Yellow", "Green"];

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function DashboardClient() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadQuestions() {
      try {
        const response = await fetch("/api/questions?sortBy=weaknessScore");
        const data = (await response.json()) as QuestionsResponse | { error: string };

        if (!response.ok || !("questions" in data)) {
          throw new Error("error" in data ? data.error : "Failed to load questions.");
        }

        setQuestions(data.questions);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load questions.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuestions();
  }, []);

  const stats = useMemo(() => {
    const statusCounts = statuses.map((status) => ({
      status,
      count: questions.filter((question) => question.status === status).length,
    }));
    const topicGroups = new Map<string, Question[]>();

    for (const question of questions) {
      const topicQuestions = topicGroups.get(question.topic) ?? [];
      topicQuestions.push(question);
      topicGroups.set(question.topic, topicQuestions);
    }

    return {
      total: questions.length,
      averageConfidence: average(questions.map((question) => question.confidence)),
      totalRevised: questions.filter((question) => question.revisionCount > 0).length,
      neverRevised: questions.filter((question) => question.revisionCount === 0).length,
      statusCounts,
      weakTopics: [...topicGroups.entries()]
        .map(([topic, topicQuestions]) => ({
          topic,
          count: topicQuestions.length,
          averageWeaknessScore: average(
            topicQuestions.map((question) => question.weaknessScore),
          ),
          redOrangeCount: topicQuestions.filter(
            (question) => question.status === "Red" || question.status === "Orange",
          ).length,
        }))
        .sort((a, b) => {
          if (b.redOrangeCount !== a.redOrangeCount) {
            return b.redOrangeCount - a.redOrangeCount;
          }

          return b.averageWeaknessScore - a.averageWeaknessScore;
        })
        .slice(0, 5),
      topWeakQuestions: questions.slice(0, 5),
    };
  }, [questions]);

  if (isLoading) {
    return <LoadingState label="Loading dashboard" />;
  }

  if (error) {
    return <EmptyState title="Could not load dashboard" description={error} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Track weak areas, revisit hard questions, and keep your revision queue focused."
        actions={
          <>
            <Button href="/daily">Open Daily 5</Button>
            <Button href="/questions/new" variant="secondary">
              Add question
            </Button>
          </>
        }
      />

      {questions.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Add your solved DSA questions to start building a revision queue."
          action={<Button href="/questions/new">Add first question</Button>}
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total questions" value={stats.total} />
            {stats.statusCounts.map((item) => (
              <MetricCard
                key={item.status}
                label={getStatusLabel(item.status)}
                value={item.count}
                status={item.status}
              />
            ))}
            <MetricCard label="Average confidence" value={stats.averageConfidence.toFixed(1)} />
            <MetricCard label="Total revised questions" value={stats.totalRevised} />
            <MetricCard label="Questions never revised" value={stats.neverRevised} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-950">Weak topics summary</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {stats.weakTopics.map((item) => (
                  <div key={item.topic} className="grid gap-3 py-3 sm:grid-cols-4">
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
                    <div>
                      <p className="text-xs text-slate-500">Red/Orange</p>
                      <p className="mt-1 font-semibold text-slate-950">{item.redOrangeCount}</p>
                    </div>
                    <div className="flex items-center sm:justify-end">
                      <Badge tone="blue">{item.topic}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-950">Top 5 weakest questions</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {stats.topWeakQuestions.map((question) => (
                  <a
                    key={question._id}
                    href={`/questions/${question._id}`}
                    className="flex items-center justify-between gap-4 py-3"
                    >
                    <div>
                      <p className="font-medium text-slate-950">{question.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {question.topic} · Confidence {question.confidence}/5 · Revised{" "}
                        {question.revisionCount}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
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
  status?: QuestionStatus;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {status ? <Badge status={status}>{getStatusLabel(status)}</Badge> : null}
      </div>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </Card>
  );
}
