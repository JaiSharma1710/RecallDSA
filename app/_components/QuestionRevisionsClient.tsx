"use client";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { LoadingState } from "@/app/_components/LoadingState";
import { PageHeader } from "@/app/_components/PageHeader";
import { PlatformBadge, SourceBadge } from "@/app/_components/PlatformBadge";
import { Select } from "@/app/_components/Select";
import type { Question, RevisionLog } from "@/app/_types/question";
import { PLATFORM_OPTIONS, getPlatformLabel } from "@/lib/platform";

type QuestionResponse = {
  question: Question;
};

type RevisionsResponse = {
  revisions: RevisionLog[];
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function getMonthKey(value: string) {
  return value.slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

export function QuestionRevisionsClient({ questionId }: { questionId: string }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [revisions, setRevisions] = useState<RevisionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [platform, setPlatform] = useState("");
  const [source, setSource] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      try {
        const [questionResponse, revisionsResponse] = await Promise.all([
          fetch(`/api/questions/${questionId}`),
          fetch(`/api/questions/${questionId}/revisions`),
        ]);
        const questionData = (await questionResponse.json()) as QuestionResponse | { error: string };
        const revisionsData = (await revisionsResponse.json()) as
          | RevisionsResponse
          | { error: string };

        if (!questionResponse.ok || !("question" in questionData)) {
          throw new Error("error" in questionData ? questionData.error : "Failed to load question.");
        }

        if (!revisionsResponse.ok || !("revisions" in revisionsData)) {
          throw new Error(
            "error" in revisionsData ? revisionsData.error : "Failed to load revisions.",
          );
        }

        if (!isActive) {
          return;
        }

        setQuestion(questionData.question);
        setRevisions(revisionsData.revisions);
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load revisions.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isActive = false;
    };
  }, [questionId]);

  const monthOptions = useMemo(
    () =>
      [...new Set(revisions.map((revision) => getMonthKey(revision.revisedAt)))]
        .sort()
        .reverse(),
    [revisions],
  );

  const filteredRevisions = useMemo(() => {
    return revisions.filter((revision) => {
      const revisionDate = new Date(revision.revisedAt);
      const revisionDateKey = toDateInputValue(revision.revisedAt);

      if (month && getMonthKey(revision.revisedAt) !== month) {
        return false;
      }

      if (fromDate && revisionDateKey < fromDate) {
        return false;
      }

      if (toDate && revisionDateKey > toDate) {
        return false;
      }

      if (platform && (revision.platform ?? "manual") !== platform) {
        return false;
      }

      if (source && (revision.source ?? "manual") !== source) {
        return false;
      }

      return !Number.isNaN(revisionDate.getTime());
    });
  }, [fromDate, month, platform, revisions, source, toDate]);

  if (isLoading) {
    return <LoadingState label="Loading revisions" />;
  }

  if (error || !question) {
    return <EmptyState title="Could not load revisions" description={error} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All revisions"
        description={question.name}
        actions={
          <>
            <Button href={`/questions/${questionId}`} variant="secondary">
              Back to question
            </Button>
            <Button href={`/questions/${questionId}/edit`} variant="secondary">
              Edit question
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Select label="Month" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="">All months</option>
            {monthOptions.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {getMonthLabel(monthKey)}
              </option>
            ))}
          </Select>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>
          <Select
            label="Platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="">All platforms</option>
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Source" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="extension">Extension</option>
          </Select>
        </div>
      </Card>

      {filteredRevisions.length === 0 ? (
        <EmptyState
          title="No revisions match these filters"
          description="Clear one or more filters to see the full revision history."
        />
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Revision entries</h2>
            <p className="text-sm text-slate-500">{filteredRevisions.length} shown</p>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {filteredRevisions.map((revision) => (
              <div key={revision._id} className="py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{formatDate(revision.revisedAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <PlatformBadge platform={revision.platform} />
                      <SourceBadge source={revision.source} />
                      <Badge>{revision.solvedWithoutHelp ? "Solved without help" : "Used help"}</Badge>
                      <Badge>{revision.neededHint ? "Needed hint" : "No hint"}</Badge>
                      <Badge>{revision.neededSolution ? "Needed solution" : "No solution"}</Badge>
                    </div>
                  </div>
                  {revision.sourceUrl ? (
                    <a
                      href={revision.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                    >
                      Open {getPlatformLabel(revision.platform)}
                    </a>
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Confidence after</dt>
                    <dd className="mt-1 font-medium text-slate-950">{revision.confidenceAfter}/5</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Felt difficulty after</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {revision.feltDifficultyAfter}/5
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Time taken</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {revision.timeTakenMinutes ? `${revision.timeTakenMinutes} min` : "Not added"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Platform</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {getPlatformLabel(revision.platform)}
                    </dd>
                  </div>
                </dl>

                {revision.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{revision.notes}</p>
                ) : null}
                {revision.mistakeNotes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {revision.mistakeNotes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
