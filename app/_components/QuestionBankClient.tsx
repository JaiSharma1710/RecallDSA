"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { Input } from "@/app/_components/Input";
import { LoadingState } from "@/app/_components/LoadingState";
import { PageHeader } from "@/app/_components/PageHeader";
import { PlatformBadgeList } from "@/app/_components/PlatformBadgeList";
import { SourceBadge } from "@/app/_components/PlatformBadge";
import { Select } from "@/app/_components/Select";
import type { Question } from "@/app/_types/question";
import { PLATFORM_OPTIONS } from "@/lib/platform";

type QuestionsResponse = {
  questions: Question[];
};

async function fetchQuestions(params?: URLSearchParams) {
  const response = await fetch(
    params ? `/api/questions?${params.toString()}` : "/api/questions?sortBy=createdAt",
  );
  const data = (await response.json()) as QuestionsResponse | { error: string };

  if (!response.ok || !("questions" in data)) {
    throw new Error("error" in data ? data.error : "Failed to load questions.");
  }

  return data.questions;
}

export function QuestionBankClient() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const [sortBy, setSortBy] = useState("weaknessScore");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const topics = useMemo(
    () => [...new Set(allQuestions.map((question) => question.topic))].sort(),
    [allQuestions],
  );

  const summary = useMemo(
    () => ({
      total: allQuestions.length,
      Red: allQuestions.filter((question) => question.status === "Red").length,
      Orange: allQuestions.filter((question) => question.status === "Orange").length,
      Yellow: allQuestions.filter((question) => question.status === "Yellow").length,
      Green: allQuestions.filter((question) => question.status === "Green").length,
    }),
    [allQuestions],
  );

  useEffect(() => {
    let isActive = true;

    async function loadSummaryQuestions() {
      try {
        const summaryQuestions = await fetchQuestions();

        if (isActive) {
          setAllQuestions(summaryQuestions);
        }
      } catch {
        if (isActive) {
          setAllQuestions([]);
        }
      }
    }

    void loadSummaryQuestions();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadFilteredQuestions() {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (topic) params.set("topic", topic);
      if (difficulty) params.set("difficulty", difficulty);
      if (status) params.set("status", status);
      if (platform) params.set("platform", platform);
      params.set("sortBy", sortBy);

      try {
        const filteredQuestions = await fetchQuestions(params);

        if (isActive) {
          setQuestions(filteredQuestions);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load questions.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadFilteredQuestions();

    return () => {
      isActive = false;
    };
  }, [difficulty, platform, search, sortBy, status, topic]);

  async function handleExport() {
    setError("");
    setImportMessage("");

    try {
      const response = await fetch("/api/questions/export");

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to export questions.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);

      link.href = url;
      link.download = filenameMatch?.[1] ?? "dsa-questions.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export questions.");
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImporting(true);
    setError("");
    setImportMessage("");

    try {
      const fileText = await file.text();
      const parsed = JSON.parse(fileText) as unknown;
      const response = await fetch("/api/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await response.json()) as {
        insertedCount?: number;
        skippedCount?: number;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to import questions.");
      }

      setImportMessage(
        `Imported ${data.insertedCount ?? 0} question(s). Skipped ${data.skippedCount ?? 0}.`,
      );
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (topic) params.set("topic", topic);
      if (difficulty) params.set("difficulty", difficulty);
      if (status) params.set("status", status);
      if (platform) params.set("platform", platform);
      params.set("sortBy", sortBy);

      const [filteredQuestions, summaryQuestions] = await Promise.all([
        fetchQuestions(params),
        fetchQuestions(),
      ]);
      setQuestions(filteredQuestions);
      setAllQuestions(summaryQuestions);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to import questions.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Bank"
        description="Filter and review every solved question in one place."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={handleExport}>
              Export JSON
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import JSON"}
            </Button>
            <Button href="/questions/new">Add question</Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {importMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {importMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total questions" value={summary.total} />
        <SummaryCard label="Red Zone" value={summary.Red} status="Red" />
        <SummaryCard label="Orange Zone" value={summary.Orange} status="Orange" />
        <SummaryCard label="Yellow Zone" value={summary.Yellow} status="Yellow" />
        <SummaryCard label="Green Zone" value={summary.Green} status="Green" />
      </section>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <Input
            label="Search by question name"
            placeholder="Two Sum"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select label="Topic" value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">All topics</option>
            {topics.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="">All difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </Select>
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All zones</option>
            <option value="Red">Red Zone</option>
            <option value="Orange">Orange Zone</option>
            <option value="Yellow">Yellow Zone</option>
            <option value="Green">Green Zone</option>
          </Select>
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
          <Select label="Sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="weaknessScore">Weakness score</option>
            <option value="lastRevisedAt">Last revised</option>
            <option value="createdAt">Newest</option>
          </Select>
        </div>
      </Card>

      {isLoading ? <LoadingState label="Loading questions" /> : null}
      {error ? <EmptyState title="Could not load questions" description={error} /> : null}

      {!isLoading && !error && questions.length === 0 ? (
        <EmptyState
          title="No matching questions"
          description="Try clearing filters or add a new solved question."
          action={<Button href="/questions/new">Add question</Button>}
        />
      ) : null}

      {!isLoading && !error && questions.length > 0 ? (
        <div className="grid gap-4">
          {questions.map((question) => (
            <Card key={question._id} className="p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/questions/${question._id}`}
                    className="text-lg font-semibold text-slate-950 hover:text-slate-700"
                  >
                    {question.name}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
                    <Badge>{question.topic}</Badge>
                    <Badge>{question.difficulty}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PlatformBadgeList
                      platforms={question.platforms}
                      fallbackPlatform={question.platform}
                    />
                    <SourceBadge source={question.capturedByExtension ? "extension" : "manual"} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {question.neededHint ? <Badge tone="blue">Needed hint</Badge> : null}
                    {question.neededSolution ? <Badge tone="blue">Needed solution</Badge> : null}
                    {!question.neededHint && !question.neededSolution ? (
                      <Badge>No help needed</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-5 lg:min-w-[32rem]">
                  <div>
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="font-semibold text-slate-950">
                      {Math.round(question.weaknessScore)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Confidence</p>
                    <p className="font-semibold text-slate-950">{question.confidence}/5</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Revisions</p>
                    <p className="font-semibold text-slate-950">{question.revisionCount}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Last revised</p>
                    <p className="font-semibold text-slate-950">
                      {formatDate(question.lastRevisedAt)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <Button href={`/questions/${question._id}`} variant="secondary">
                  View details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status?: Question["status"];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {status ? <Badge status={status}>{getStatusLabel(status)}</Badge> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </Card>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}
