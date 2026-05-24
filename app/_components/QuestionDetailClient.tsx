"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { Input } from "@/app/_components/Input";
import { LoadingState } from "@/app/_components/LoadingState";
import { QuestionLinksModal } from "@/app/_components/QuestionLinksModal";
import { PlatformBadgeList } from "@/app/_components/PlatformBadgeList";
import { PlatformBadge, SourceBadge } from "@/app/_components/PlatformBadge";
import { Select } from "@/app/_components/Select";
import { Textarea } from "@/app/_components/Textarea";
import type { Question, QuestionLink, RevisionLog } from "@/app/_types/question";
import { getQuestionLinkChoices } from "@/lib/question-links";
import { PLATFORM_OPTIONS, normalizePlatforms } from "@/lib/platform";

type QuestionResponse = {
  question: Question;
};

type RevisionsResponse = {
  revisions: RevisionLog[];
};

type RevisionForm = {
  solveStatus: string;
  confidenceAfter: string;
  feltDifficultyAfter: string;
  timeTakenMinutes: string;
  platform: string;
  notes: string;
  mistakeNotes: string;
};

type QuestionAnalytics = {
  confidenceOverTime: Array<{ date: string; confidence: number }>;
  difficultyOverTime: Array<{ date: string; feltDifficulty: number }>;
  timeOverTime: Array<{ date: string; timeTakenMinutes: number }>;
  helpCounts: {
    solvedWithoutHelp: number;
    neededHint: number;
    neededSolution: number;
  };
  revisionCount: number;
  averageTime: number | null;
  bestConfidence: number | null;
  latestConfidence: number | null;
  latestDifficulty: number | null;
  solvedWithoutHelpCount: number;
  lastRevisedDate: string | null;
  platforms: string[];
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getQuestionLinks(question: Question): QuestionLink[] {
  return getQuestionLinkChoices({
    questionLinks: question.questionLinks,
    platforms: question.platforms,
    fallbackPlatform: question.platform,
    link: question.link,
    sourceUrl: question.sourceUrl,
    platformSlug: question.platformSlug,
  }) as QuestionLink[];
}

function getPriorityMessage(question: Question) {
  if (question.status === "Red") {
    return "This question is slipping. Bring it back into active recall before the gap grows.";
  }

  if (question.status === "Orange") {
    return "This one still needs attention. A clean revision here should strengthen retention fast.";
  }

  if (question.status === "Yellow") {
    return "You are in a decent spot here. One mindful revision keeps it from drifting.";
  }

  return "Memory looks healthy here. Use it for a confidence-preserving quick pass when needed.";
}

function getConfidenceCopy(confidence: number) {
  if (confidence <= 2) {
    return "Low confidence right now";
  }

  if (confidence === 3) {
    return "Moderate clarity";
  }

  if (confidence === 4) {
    return "Strong understanding";
  }

  return "Very stable recall";
}

function getSolveStatusLabel(revision: RevisionLog) {
  if (revision.solvedWithoutHelp) {
    return "Solved without help";
  }

  if (revision.neededHint) {
    return "Needed a hint";
  }

  if (revision.neededSolution) {
    return "Needed the solution";
  }

  return "Revision logged";
}

function getHelpSummary(analytics: QuestionAnalytics | null) {
  if (!analytics || analytics.revisionCount === 0) {
    return "No revision logs yet";
  }

  const independentRate = Math.round(
    (analytics.helpCounts.solvedWithoutHelp / analytics.revisionCount) * 100,
  );

  if (independentRate >= 70) {
    return `${independentRate}% of revisions were solved independently`;
  }

  if (independentRate >= 40) {
    return `${independentRate}% independent so far, still room to tighten recall`;
  }

  return `${independentRate}% independent so far, this is still in active rebuilding mode`;
}

async function fetchQuestionData(questionId: string) {
  const [questionResponse, revisionsResponse] = await Promise.all([
    fetch(`/api/questions/${questionId}`),
    fetch(`/api/questions/${questionId}/revisions`),
  ]);
  const questionData = (await questionResponse.json()) as QuestionResponse | { error: string };
  const revisionsData = (await revisionsResponse.json()) as RevisionsResponse | { error: string };

  if (!questionResponse.ok || !("question" in questionData)) {
    throw new Error("error" in questionData ? questionData.error : "Failed to load question.");
  }

  if (!revisionsResponse.ok || !("revisions" in revisionsData)) {
    throw new Error("error" in revisionsData ? revisionsData.error : "Failed to load revisions.");
  }

  return {
    question: questionData.question,
    revisions: revisionsData.revisions,
  };
}

export function QuestionDetailClient({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [revisions, setRevisions] = useState<RevisionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<RevisionForm>({
    solveStatus: "solved_without_help",
    confidenceAfter: "3",
    feltDifficultyAfter: "3",
    timeTakenMinutes: "",
    platform: "manual",
    notes: "",
    mistakeNotes: "",
  });
  const [analytics, setAnalytics] = useState<QuestionAnalytics | null>(null);

  useEffect(() => {
    let isActive = true;

    Promise.all([fetchQuestionData(questionId), fetch(`/api/questions/${questionId}/analytics`)])
      .then(async ([data, analyticsResponse]) => {
        const analyticsData = (await analyticsResponse.json()) as QuestionAnalytics | {
          error: string;
        };

        if (!isActive) {
          return;
        }

        setQuestion(data.question);
        setRevisions(data.revisions);
        if (analyticsResponse.ok && "revisionCount" in analyticsData) {
          setAnalytics(analyticsData);
        }
        setForm((current) => ({
          ...current,
          confidenceAfter: String(data.question.confidence),
          feltDifficultyAfter: String(data.question.feltDifficulty),
          platform:
            normalizePlatforms(data.question.platforms, data.question.platform).find(
              (platform) => platform !== "manual",
            ) ??
            data.question.platform ??
            "manual",
        }));
      })
      .catch((loadError) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load question.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [questionId]);

  async function refreshQuestion() {
    const [refreshedData, analyticsResponse] = await Promise.all([
      fetchQuestionData(questionId),
      fetch(`/api/questions/${questionId}/analytics`),
    ]);
    const analyticsData = (await analyticsResponse.json()) as QuestionAnalytics | {
      error: string;
    };

    setQuestion(refreshedData.question);
    setRevisions(refreshedData.revisions);
    if (analyticsResponse.ok && "revisionCount" in analyticsData) {
      setAnalytics(analyticsData);
    }
  }

  async function handleRevisionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const solvedWithoutHelp = form.solveStatus === "solved_without_help";
      const neededHint = form.solveStatus === "needed_hint";
      const neededSolution = form.solveStatus === "needed_solution";
      const response = await fetch(`/api/questions/${questionId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solvedWithoutHelp,
          neededHint,
          neededSolution,
          confidenceAfter: Number(form.confidenceAfter),
          feltDifficultyAfter: Number(form.feltDifficultyAfter),
          timeTakenMinutes: form.timeTakenMinutes ? Number(form.timeTakenMinutes) : undefined,
          platform: form.platform,
          notes: form.notes || undefined,
          mistakeNotes: form.mistakeNotes || undefined,
        }),
      });
      const data = (await response.json()) as { question?: Question; error?: string };

      if (!response.ok || !data.question) {
        throw new Error(data.error ?? "Failed to save revision.");
      }

      setForm((current) => ({
        ...current,
        timeTakenMinutes: "",
        notes: "",
        mistakeNotes: "",
      }));
      await refreshQuestion();
      setIsRevisionOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save revision.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this question?")) {
      return;
    }

    const response = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });

    if (response.ok) {
      router.push("/questions");
      router.refresh();
    }
  }

  const questionLinks = useMemo(() => {
    if (!question) {
      return [];
    }

    return getQuestionLinks(question);
  }, [question]);

  if (isLoading) {
    return <LoadingState label="Loading question" />;
  }

  if (error && !question) {
    return <EmptyState title="Could not load question" description={error} />;
  }

  if (!question) {
    return <EmptyState title="Question not found" />;
  }

  const recentRevisions = revisions.slice(0, 5);
  const confidenceTrend =
    analytics && analytics.bestConfidence !== null && analytics.latestConfidence !== null
      ? analytics.latestConfidence - analytics.bestConfidence
      : null;

  return (
    <div className="space-y-6">
      <QuestionLinksModal
        isOpen={isLinkModalOpen}
        questionId={questionId}
        questionName={question.name}
        links={questionLinks}
        onClose={() => setIsLinkModalOpen(false)}
      />

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-4">
                <Badge tone="blue">Question Detail</Badge>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                      {question.name}
                    </h1>
                    <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
                  </div>
                  <p className="max-w-3xl text-lg leading-8 text-slate-600">
                    {getPriorityMessage(question)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{question.topic}</Badge>
                  <Badge>{question.difficulty}</Badge>
                  <Badge>{getConfidenceCopy(question.confidence)}</Badge>
                  {question.solvedAt ? <Badge>First solved {formatDate(question.solvedAt)}</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <PlatformBadgeList platforms={question.platforms} fallbackPlatform={question.platform} />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 xl:max-w-[260px] xl:justify-end">
                {questionLinks.length > 0 ? (
                  <Button type="button" variant="secondary" onClick={() => setIsLinkModalOpen(true)}>
                    Open question
                  </Button>
                ) : null}
                <Button href={`/questions/${questionId}/edit`} variant="secondary">
                  Edit question
                </Button>
                <Button type="button" onClick={() => setIsRevisionOpen(true)}>
                  Mark revised
                </Button>
                <Button type="button" variant="danger" onClick={handleArchive}>
                  Archive
                </Button>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Weakness score"
                value={Math.round(question.weaknessScore)}
                helper="Higher means this needs more attention."
                tint="blue"
              />
              <MetricCard
                label="Confidence"
                value={`${question.confidence}/5`}
                helper={getConfidenceCopy(question.confidence)}
                tint="emerald"
              />
              <MetricCard
                label="Revisions logged"
                value={question.revisionCount}
                helper={
                  question.revisionCount === 0
                    ? "No follow-up revisions yet."
                    : `${question.solvedWithoutHelpCount} independent revision${
                        question.solvedWithoutHelpCount === 1 ? "" : "s"
                      }`
                }
                tint="violet"
              />
              <MetricCard
                label="Last revised"
                value={formatDate(question.lastRevisedAt)}
                helper={
                  question.nextReviewAt
                    ? `Suggested next review: ${formatDate(question.nextReviewAt)}`
                    : "No upcoming review date saved."
                }
                tint="amber"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Revision Snapshot
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Where you stand</h2>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {getStatusLabel(question.status)}
              </div>
            </div>

            <div className="space-y-4">
              <SnapshotRow
                label="Latest confidence"
                value={
                  analytics?.latestConfidence !== null && analytics?.latestConfidence !== undefined
                    ? `${analytics.latestConfidence}/5`
                    : `${question.confidence}/5`
                }
                helper="Current self-rated recall level"
              />
              <SnapshotRow
                label="Average revision time"
                value={analytics?.averageTime ? `${analytics.averageTime.toFixed(1)} min` : "Not enough data"}
                helper="Only counted when you log time"
              />
              <SnapshotRow
                label="Support pattern"
                value={getHelpSummary(analytics)}
                helper="How often you are solving this on your own"
              />
              <SnapshotRow
                label="Last active"
                value={formatDateTime(analytics?.lastRevisedDate ?? question.lastRevisedAt)}
                helper="Most recent revision touchpoint"
              />
            </div>

            <div className="border-t border-slate-200 pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Revision Guidance
              </p>
              <div className="mt-4 space-y-4">
                <InsightItem
                  title="Focus today"
                  description={getPriorityMessage(question)}
                />
                <InsightItem
                  title="What to optimize"
                  description={
                    question.neededSolution
                      ? "Try one active-recall pass without peeking at the full solution."
                      : question.neededHint
                        ? "Aim to convert hint-assisted recalls into clean independent solves."
                        : "You are already solving this well. Preserve it with faster, lighter reviews."
                  }
                />
                <InsightItem
                  title="Trend read"
                  description={
                    confidenceTrend === null
                      ? "A few more revisions will make progress patterns easier to read."
                      : confidenceTrend >= 0
                        ? "Confidence is holding or improving across revisions."
                        : "Recent revisions show some drop in confidence, so this deserves a closer pass."
                  }
                />
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          {isRevisionOpen ? (
            <Card className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Revision Entry
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Log today’s pass</h2>
                </div>
                <Button type="button" variant="ghost" onClick={() => setIsRevisionOpen(false)}>
                  Cancel
                </Button>
              </div>

              <form onSubmit={handleRevisionSubmit} className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Select
                    label="Solve status"
                    value={form.solveStatus}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, solveStatus: event.target.value }))
                    }
                  >
                    <option value="solved_without_help">Solved without help</option>
                    <option value="needed_hint">Needed hint</option>
                    <option value="needed_solution">Needed solution</option>
                  </Select>
                  <Input
                    label="Confidence after"
                    type="number"
                    min={1}
                    max={5}
                    value={form.confidenceAfter}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, confidenceAfter: event.target.value }))
                    }
                  />
                  <Input
                    label="Felt difficulty after"
                    type="number"
                    min={1}
                    max={5}
                    value={form.feltDifficultyAfter}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        feltDifficultyAfter: event.target.value,
                      }))
                    }
                  />
                  <Input
                    label="Time in minutes"
                    type="number"
                    min={0}
                    value={form.timeTakenMinutes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, timeTakenMinutes: event.target.value }))
                    }
                  />
                  <Select
                    label="Solved on platform"
                    value={form.platform}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, platform: event.target.value }))
                    }
                  >
                    {PLATFORM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <Textarea
                  label="What felt clearer this time?"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />

                <Textarea
                  label="Mistakes or traps to remember"
                  value={form.mistakeNotes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, mistakeNotes: event.target.value }))
                  }
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save revision"}
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Revision History
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Latest revision passes
                </h2>
              </div>
              {revisions.length > 5 ? (
                <Button href={`/questions/${questionId}/revisions`} variant="secondary">
                  View all revisions
                </Button>
              ) : null}
            </div>

            {revisions.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                No revisions logged yet. Your first follow-up pass will start the revision timeline.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {recentRevisions.map((revision) => (
                  <div
                    key={revision._id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="blue">{formatDateTime(revision.revisedAt)}</Badge>
                          <Badge>{getSolveStatusLabel(revision)}</Badge>
                          <PlatformBadge platform={revision.platform} />
                          <SourceBadge source={revision.source} />
                        </div>
                        <div className="grid gap-3 text-sm sm:grid-cols-3">
                          <HistoryStat
                            label="Confidence after"
                            value={`${revision.confidenceAfter}/5`}
                          />
                          <HistoryStat
                            label="Felt difficulty"
                            value={`${revision.feltDifficultyAfter}/5`}
                          />
                          <HistoryStat
                            label="Time taken"
                            value={
                              revision.timeTakenMinutes ? `${revision.timeTakenMinutes} min` : "Not added"
                            }
                          />
                        </div>
                      </div>

                      {revision.sourceUrl ? (
                        <a
                          href={revision.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Open problem
                        </a>
                      ) : null}
                    </div>

                    {revision.mistakeNotes ? (
                      <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <span className="font-medium">Mistake note:</span> {revision.mistakeNotes}
                      </div>
                    ) : null}
                    {revision.notes ? (
                      <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {revision.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Question Brief
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <DetailRow label="Question name" value={question.name} />
                <DetailRow label="Topic" value={question.topic} />
                <DetailRow label="Difficulty" value={question.difficulty} />
                <DetailRow label="Status" value={getStatusLabel(question.status)} />
                <DetailRow label="First solved" value={formatDate(question.solvedAt)} />
                <DetailRow label="Last revised" value={formatDate(question.lastRevisedAt)} />
                <DetailRow
                  label="Question links"
                  value={
                    questionLinks.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setIsLinkModalOpen(true)}
                        className="text-left text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                      >
                        Choose platform link
                      </button>
                    ) : (
                      "Not added"
                    )
                  }
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Notes Bank
              </p>
              <div className="mt-5 space-y-4">
                <NoteBlock
                  title="Revision notes"
                  body={question.notes ?? "No personal notes saved for this question yet."}
                />
                <NoteBlock
                  title="Mistake notes"
                  body={question.mistakeNotes ?? "No repeated traps or mistakes saved yet."}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Quick Read
              </p>
              <div className="mt-5 space-y-4">
                <SnapshotRow
                  label="Solved without help"
                  value={`${question.solvedWithoutHelpCount} time${
                    question.solvedWithoutHelpCount === 1 ? "" : "s"
                  }`}
                  helper="Independent recalls logged so far"
                />
                <SnapshotRow
                  label="Hint usage"
                  value={question.neededHint ? "Hint was needed before" : "No hint flag right now"}
                  helper="Useful signal when deciding revision priority"
                />
                <SnapshotRow
                  label="Solution dependency"
                  value={
                    question.neededSolution
                      ? "Solution was needed at least once"
                      : "No recent full-solution dependency"
                  }
                  helper="Tracks whether recall is still fragile"
                />
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tint,
}: {
  label: string;
  value: string | number;
  helper: string;
  tint: "blue" | "emerald" | "violet" | "amber";
}) {
  const tintClasses = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className={`inline-flex rounded-2xl px-3 py-1 text-xs font-semibold ${tintClasses[tint]}`}>
        {label}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-semibold leading-7 text-slate-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function InsightItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <div className="mt-2 text-sm font-medium leading-6 text-slate-950">{value}</div>
    </div>
  );
}

function NoteBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
