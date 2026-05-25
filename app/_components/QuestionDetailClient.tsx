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
    return "This question still needs attention. A clean revision here should strengthen retention fast.";
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

function getDifficultyChip(difficulty: Question["difficulty"]) {
  if (difficulty === "Medium") {
    return "Moderate clarity";
  }

  return difficulty;
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

function getStatusBadgeClass(status: Question["status"]) {
  if (status === "Red") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "Orange") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (status === "Yellow") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getStatusDotClass(status: Question["status"]) {
  if (status === "Red") {
    return "bg-red-500";
  }

  if (status === "Orange") {
    return "bg-orange-500";
  }

  if (status === "Yellow") {
    return "bg-amber-500";
  }

  return "bg-emerald-500";
}

function getGuidanceAccent(kind: "focus" | "optimize" | "trend") {
  if (kind === "focus") {
    return "from-blue-50 to-white text-blue-600";
  }

  if (kind === "optimize") {
    return "from-emerald-50 to-white text-emerald-600";
  }

  return "from-violet-50 to-white text-violet-600";
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
  const latestRevision = revisions[0] ?? null;
  const confidenceTrend =
    analytics && analytics.bestConfidence !== null && analytics.latestConfidence !== null
      ? analytics.latestConfidence - analytics.bestConfidence
      : null;
  const snapshotConfidence =
    analytics?.latestConfidence !== null && analytics?.latestConfidence !== undefined
      ? analytics.latestConfidence
      : question.confidence;
  const averageTime =
    analytics?.averageTime !== null && analytics?.averageTime !== undefined
      ? `${analytics.averageTime.toFixed(1)} min`
      : "Not enough data";
  const supportValue =
    analytics && analytics.revisionCount > 0
      ? `${Math.round((analytics.helpCounts.solvedWithoutHelp / analytics.revisionCount) * 100)}% independent so far`
      : "No revision logs yet";

  return (
    <div className="space-y-6">
      <QuestionLinksModal
        isOpen={isLinkModalOpen}
        questionId={questionId}
        questionName={question.name}
        links={questionLinks}
        onClose={() => setIsLinkModalOpen(false)}
      />

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-[30px] border-[var(--surface-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,255,0.92)_100%)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="flex flex-col gap-8">
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => router.push("/questions")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  <ArrowLeftIcon />
                  Question Detail
                </button>

                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                        {question.name}
                      </h1>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${getStatusBadgeClass(question.status)}`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(question.status)}`} />
                        {getStatusLabel(question.status)}
                      </span>
                    </div>
                    <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                      {getPriorityMessage(question)}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Badge tone="blue">{question.topic}</Badge>
                      <Badge>{question.difficulty}</Badge>
                      <Badge>{getDifficultyChip(question.difficulty)}</Badge>
                      <Badge>{question.platform?.toUpperCase() ?? "Manual"}</Badge>
                    </div>
                  </div>

                  <div
                    className={`inline-flex w-fit items-center rounded-full border px-4 py-2 text-sm font-semibold ${getStatusBadgeClass(question.status)}`}
                  >
                    {getStatusLabel(question.status)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {questionLinks.length > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsLinkModalOpen(true)}
                      className="min-h-10 rounded-2xl border-slate-200 px-4 text-sm"
                    >
                      <ActionIcon>
                        <OpenIcon />
                      </ActionIcon>
                      Open Question
                    </Button>
                  ) : null}
                  <Button
                    href={`/questions/${questionId}/edit`}
                    variant="secondary"
                    className="min-h-10 rounded-2xl border-slate-200 px-4 text-sm"
                  >
                    <ActionIcon>
                      <EditIcon />
                    </ActionIcon>
                    Edit Question
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsRevisionOpen((current) => !current)}
                    className="min-h-10 rounded-2xl bg-slate-950 px-4 text-sm hover:bg-slate-800"
                  >
                    <ActionIcon>
                      <CheckIcon />
                    </ActionIcon>
                    {isRevisionOpen ? "Close Revision" : "Mark Revised"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleArchive}
                    className="min-h-10 rounded-2xl border-red-200 px-4 text-sm text-red-600 hover:bg-red-50"
                  >
                    <ActionIcon>
                      <ArchiveIcon />
                    </ActionIcon>
                    Archive
                  </Button>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 sm:grid-cols-2 xl:grid-cols-4">
                <HeroMetric
                  icon={<TrendUpIcon />}
                  label="Weakness score"
                  value={Math.round(question.weaknessScore)}
                  helper="Higher means this needs more attention."
                  tint="blue"
                />
                <HeroMetric
                  icon={<ShieldIcon />}
                  label="Confidence"
                  value={`${question.confidence}/5`}
                  helper={getConfidenceCopy(question.confidence)}
                  tint="emerald"
                />
                <HeroMetric
                  icon={<NotesIcon />}
                  label="Revisions logged"
                  value={question.revisionCount}
                  helper={
                    question.revisionCount === 0
                      ? "0 independent revisions"
                      : `${question.solvedWithoutHelpCount} independent revision${
                          question.solvedWithoutHelpCount === 1 ? "" : "s"
                        }`
                  }
                  tint="violet"
                />
                <HeroMetric
                  icon={<CalendarIcon />}
                  label="Last revised"
                  value={formatDate(question.lastRevisedAt)}
                  helper={
                    question.nextReviewAt
                      ? `Suggested next review: ${formatDate(question.nextReviewAt)}`
                      : "No upcoming review date saved."
                  }
                  tint="amber"
                  isLast
                />
              </div>
            </div>
          </Card>

          {isRevisionOpen ? (
            <Card className="rounded-[28px] border-[var(--surface-border)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Revision Entry
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
                    Log today&apos;s pass
                  </h2>
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

          <Card className="rounded-[30px] border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <HistoryIcon />
                  </div>
                  <p className="text-lg font-semibold text-slate-950">Latest revision passes</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {latestRevision?.sourceUrl ? (
                  <a
                    href={latestRevision.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                  >
                    Open problem
                  </a>
                ) : null}
                {revisions.length > 5 ? (
                  <Button href={`/questions/${questionId}/revisions`} variant="secondary">
                    View all revisions
                  </Button>
                ) : null}
              </div>
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
                    className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-sm"
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

          <Card className="rounded-[30px] border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <DocumentIcon />
                </span>
                <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
                  Question Brief
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <DetailListRow label="Question name" value={question.name} />
                <DetailListRow label="Topic" value={question.topic} />
                <DetailListRow label="Difficulty" value={question.difficulty} />
                <DetailListRow label="Status" value={getStatusLabel(question.status)} />
                <DetailListRow label="Last revised" value={formatDate(question.lastRevisedAt)} />
                <DetailListRow
                  label="Question links"
                  value={
                    questionLinks.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setIsLinkModalOpen(true)}
                        className="text-left text-sm font-semibold text-blue-600 hover:text-blue-700"
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
          </Card>

          <Card className="rounded-[30px] border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <DocumentIcon />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
                    Revision & mistake notes
                  </h2>
                  <p className="text-sm text-slate-500">
                    Keep your personal notes for this question.
                  </p>
                </div>
              </div>
              <Button href={`/questions/${questionId}/edit`} variant="secondary">
                View notes
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[30px] border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <SparkIcon />
                  </span>
                  <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
                    AI Revision Snapshot
                  </h2>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusBadgeClass(question.status)}`}
                >
                  {getStatusLabel(question.status)}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SnapshotTile
                  icon={<BarsIcon />}
                  label="Latest confidence"
                  value={`${snapshotConfidence}/5`}
                  helper="Current self-rated recall level"
                />
                <SnapshotTile
                  icon={<ClockIcon />}
                  label="Average revision time"
                  value={averageTime}
                  helper="Only counted when you log time"
                />
                <SnapshotTile
                  icon={<ShieldOutlineIcon />}
                  label="Support pattern"
                  value={supportValue}
                  helper={getHelpSummary(analytics)}
                />
                <SnapshotTile
                  icon={<CalendarIcon />}
                  label="Last active"
                  value={formatDateTime(analytics?.lastRevisedDate ?? question.lastRevisedAt)}
                  helper="Most recent revision touchpoint"
                />
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <TargetIcon />
                </span>
                <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
                  Revision Guidance
                </h2>
              </div>
              <GuidanceCard
                title="Focus today"
                description={getPriorityMessage(question)}
                icon={<TargetIcon />}
                kind="focus"
              />
              <GuidanceCard
                title="What to optimize"
                description={
                  question.neededSolution
                    ? "Aim for one clean active-recall pass before checking the full solution."
                    : question.neededHint
                      ? "Convert hint-assisted recalls into cleaner independent solves."
                      : "Keep the recall loop light and fast so this stays stable."
                }
                icon={<TrendUpIcon />}
                kind="optimize"
              />
              <GuidanceCard
                title="Trend read"
                description={
                  confidenceTrend === null
                    ? "A few more revisions will make progress patterns easier to read."
                    : confidenceTrend >= 0
                      ? "Confidence is holding or improving across revisions."
                      : "Recent revisions show some drop in confidence, so this deserves a closer pass."
                }
                icon={<TrendIcon />}
                kind="trend"
              />
            </div>
          </Card>

          <Card className="rounded-[30px] border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <BookIcon />
                </span>
                <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
                  Notes Bank
                </h2>
              </div>
              <NoteBlock
                title="Revision notes"
                body={question.notes ?? "No personal notes saved for this question yet."}
              />
              <NoteBlock
                title="Mistake notes"
                body={question.mistakeNotes ?? "No repeated traps or mistakes saved yet."}
              />
            </div>
          </Card>

          <Card className="rounded-[30px] border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <BoltIcon />
                </span>
                <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
                  Quick Read
                </h2>
              </div>
              <QuickReadTile
                label="Solved without help"
                value={`${question.solvedWithoutHelpCount} time${
                  question.solvedWithoutHelpCount === 1 ? "" : "s"
                }`}
                helper="Independent recalls logged so far"
              />
              <QuickReadTile
                label="Hint usage"
                value={question.neededHint ? "Hint was needed before" : "No hint flag right now"}
                helper="Useful signal when deciding revision priority"
              />
              <QuickReadTile
                label="Solution dependency"
                value={
                  question.neededSolution
                    ? "Solution was needed at least once"
                    : "No recent full-solution dependency"
                }
                helper="Tracks whether recall is still fragile"
              />
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  helper,
  tint,
  isLast = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper: string;
  tint: "blue" | "emerald" | "violet" | "amber";
  isLast?: boolean;
}) {
  const tintClasses = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className={`p-5 ${isLast ? "" : "border-b border-slate-200/80 sm:border-b-0 xl:border-r xl:border-slate-200/80"}`}>
      <div className="flex items-start gap-4">
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tintClasses[tint]}`}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950">{value}</p>
          <p className="mt-2 max-w-[18ch] text-xs leading-5 text-slate-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function SnapshotTile({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-blue-700">
          {icon}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className="mt-2 text-lg font-bold tracking-[-0.02em] text-slate-950">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function GuidanceCard({
  title,
  description,
  icon,
  kind,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  kind: "focus" | "optimize" | "trend";
}) {
  return (
    <div className={`rounded-[24px] border border-slate-200 bg-gradient-to-br ${getGuidanceAccent(kind)} p-4`}>
      <div className="flex items-start gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
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

function DetailListRow({
  label,
  value,
}: {
  label: string;
  value: string | number | ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <div className="mt-2 text-base font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function QuickReadTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function NoteBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function ActionIcon({ children }: { children: ReactNode }) {
  return <span className="mr-2 inline-flex h-5 w-5 items-center justify-center">{children}</span>;
}

function IconBase({
  children,
  className = "",
  viewBox = "0 0 24 24",
}: {
  children: ReactNode;
  className?: string;
  viewBox?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 ${className}`}
    >
      {children}
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <IconBase className="h-4 w-4">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </IconBase>
  );
}

function OpenIcon() {
  return (
    <IconBase>
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    </IconBase>
  );
}

function EditIcon() {
  return (
    <IconBase>
      <path d="m4 20 4.5-1 9-9a2.1 2.1 0 1 0-3-3l-9 9L4 20Z" />
      <path d="m13.5 6.5 3 3" />
    </IconBase>
  );
}

function CheckIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </IconBase>
  );
}

function ArchiveIcon() {
  return (
    <IconBase>
      <path d="M4 7h16" />
      <path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M9 12h6" />
      <path d="M5 4h14l1 3H4l1-3Z" />
    </IconBase>
  );
}

function TrendUpIcon() {
  return (
    <IconBase>
      <path d="m4 16 5-5 4 4 7-8" />
      <path d="M15 7h5v5" />
    </IconBase>
  );
}

function ShieldIcon() {
  return (
    <IconBase>
      <path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.2-3.8" />
    </IconBase>
  );
}

function NotesIcon() {
  return (
    <IconBase>
      <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </IconBase>
  );
}

function CalendarIcon() {
  return (
    <IconBase>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 10h18" />
    </IconBase>
  );
}

function HistoryIcon() {
  return (
    <IconBase>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 8v5l3 2" />
    </IconBase>
  );
}

function SparkIcon() {
  return (
    <IconBase>
      <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
    </IconBase>
  );
}

function BarsIcon() {
  return (
    <IconBase>
      <path d="M5 18V9" />
      <path d="M10 18V5" />
      <path d="M15 18v-7" />
      <path d="M20 18V3" />
    </IconBase>
  );
}

function ClockIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </IconBase>
  );
}

function ShieldOutlineIcon() {
  return (
    <IconBase>
      <path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z" />
    </IconBase>
  );
}

function TargetIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </IconBase>
  );
}

function TrendIcon() {
  return (
    <IconBase>
      <path d="m5 15 4-4 3 3 7-8" />
      <path d="M15 6h4v4" />
    </IconBase>
  );
}

function DocumentIcon() {
  return (
    <IconBase>
      <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v5h5" />
    </IconBase>
  );
}

function BookIcon() {
  return (
    <IconBase>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21Z" />
      <path d="M4 5.5v15" />
      <path d="M8 7h8" />
    </IconBase>
  );
}

function BoltIcon() {
  return (
    <IconBase>
      <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />
    </IconBase>
  );
}
