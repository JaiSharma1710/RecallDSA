"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { Input } from "@/app/_components/Input";
import { LoadingState } from "@/app/_components/LoadingState";
import { PlatformBadgeList } from "@/app/_components/PlatformBadgeList";
import { SourceBadge } from "@/app/_components/PlatformBadge";
import { Select } from "@/app/_components/Select";
import type { Question } from "@/app/_types/question";
import { PLATFORM_OPTIONS } from "@/lib/platform";

type QuestionsResponse = {
  questions: Question[];
};

type BankTab = "all" | "weak" | "recent";

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

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function isRecentlyRevised(question: Question) {
  if (!question.lastRevisedAt) {
    return false;
  }

  const revisedAt = new Date(question.lastRevisedAt);
  const now = new Date();
  const diff = now.getTime() - revisedAt.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  return days <= 7;
}

function getStatusIcon(status?: Question["status"]) {
  if (status === "Red") return <RedZoneIcon />;
  if (status === "Orange") return <OrangeZoneIcon />;
  if (status === "Yellow") return <YellowZoneIcon />;
  if (status === "Green") return <GreenZoneIcon />;
  return <StackIcon />;
}

function getQuestionAccent(status: Question["status"]) {
  switch (status) {
    case "Red":
      return "before:bg-red-500";
    case "Orange":
      return "before:bg-orange-500";
    case "Yellow":
      return "before:bg-amber-500";
    case "Green":
      return "before:bg-emerald-500";
    default:
      return "before:bg-slate-300";
  }
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
  const [activeTab, setActiveTab] = useState<BankTab>("all");
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

  const weakCount = useMemo(
    () => allQuestions.filter((question) => question.status === "Red" || question.status === "Orange").length,
    [allQuestions],
  );

  const recentCount = useMemo(
    () => allQuestions.filter((question) => isRecentlyRevised(question)).length,
    [allQuestions],
  );

  const displayedQuestions = useMemo(() => {
    if (activeTab === "weak") {
      return questions.filter((question) => question.status === "Red" || question.status === "Orange");
    }

    if (activeTab === "recent") {
      return questions.filter((question) => isRecentlyRevised(question));
    }

    return questions;
  }, [activeTab, questions]);

  useEffect(() => {
    let isActive = true;

    fetchQuestions()
      .then((summaryQuestions) => {
        if (isActive) {
          setAllQuestions(summaryQuestions);
        }
      })
      .catch(() => {
        if (isActive) {
          setAllQuestions([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (topic) params.set("topic", topic);
    if (difficulty) params.set("difficulty", difficulty);
    if (status) params.set("status", status);
    if (platform) params.set("platform", platform);
    params.set("sortBy", sortBy);

    fetchQuestions(params)
      .then((filteredQuestions) => {
        if (isActive) {
          setQuestions(filteredQuestions);
        }
      })
      .catch((loadError) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load questions.");
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
  }, [difficulty, platform, search, sortBy, status, topic]);

  async function refreshQuestions() {
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
  }

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
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to import questions.");
      }

      setImportMessage(
        `Imported ${data.insertedCount ?? 0} question(s). Skipped ${data.skippedCount ?? 0}.`,
      );
      await refreshQuestions();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to import questions.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  const totalDisplayed = displayedQuestions.length;
  const totalInspected = summary.Red + summary.Orange + summary.Yellow + summary.Green;

  return (
    <div className="space-y-7">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="relative overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.6),_rgba(255,255,255,0.97)_36%,_rgba(241,245,249,0.8)_100%)] p-6 shadow-[0_30px_100px_-44px_rgba(15,23,42,0.38)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),transparent_40%,rgba(191,219,254,0.24))]" />
        <div className="relative space-y-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] border border-blue-100 bg-white text-blue-600 shadow-sm">
                <StackIcon />
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Question Bank
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                    Filter, review, and manage every solved question in one place, with quick insight into what needs attention next.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
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
              <Button href="/questions/new">Add Question</Button>
            </div>
          </div>

          {importMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {importMessage}
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Total Questions"
              value={summary.total}
              note="all-time solved"
              accent="from-blue-500/15 to-blue-50"
            />
            <SummaryCard
              label="Red Zone"
              value={summary.Red}
              note="needs urgent focus"
              status="Red"
              accent="from-red-500/15 to-red-50"
            />
            <SummaryCard
              label="Orange Zone"
              value={summary.Orange}
              note="needs attention"
              status="Orange"
              accent="from-orange-500/15 to-orange-50"
            />
            <SummaryCard
              label="Yellow Zone"
              value={summary.Yellow}
              note="review soon"
              status="Yellow"
              accent="from-amber-500/15 to-amber-50"
            />
            <SummaryCard
              label="Green Zone"
              value={summary.Green}
              note="strong memory"
              status="Green"
              accent="from-emerald-500/15 to-emerald-50"
            />
          </section>
        </div>
      </div>

      <Card className="rounded-[28px] p-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-[2.65rem] h-5 w-5 text-slate-400" />
            <Input
              label="Search"
              placeholder="Search by question name..."
              value={search}
              className="pl-11"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
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
          <Select label="Status / Zone" value={status} onChange={(event) => setStatus(event.target.value)}>
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearch("");
              setTopic("");
              setDifficulty("");
              setStatus("");
              setPlatform("");
              setSortBy("weaknessScore");
            }}
          >
            Filters
          </Button>
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
        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <Card className="rounded-[28px] p-0 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <TabButton
                    label="All Questions"
                    isActive={activeTab === "all"}
                    onClick={() => setActiveTab("all")}
                  />
                  <TabButton
                    label={`Weak (${weakCount})`}
                    isActive={activeTab === "weak"}
                    onClick={() => setActiveTab("weak")}
                  />
                  <TabButton
                    label={`Recently Revised (${recentCount})`}
                    isActive={activeTab === "recent"}
                    onClick={() => setActiveTab("recent")}
                  />
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>{totalDisplayed} results</span>
                  <div className="flex gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600">
                      <ListIcon />
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400">
                      <GridIcon />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {displayedQuestions.map((question, index) => (
                <article
                  key={question._id}
                  className={`relative px-5 py-6 sm:px-6 before:absolute before:left-0 before:top-6 before:h-[calc(100%-3rem)] before:w-1 before:rounded-r-full ${getQuestionAccent(question.status)}`}
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-5">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Question {index + 1}</p>
                          <Link
                            href={`/questions/${question._id}`}
                            className="block text-xl font-semibold tracking-tight text-slate-950 hover:text-slate-700"
                          >
                            {question.name}
                          </Link>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
                          <Badge>{question.topic}</Badge>
                          <Badge>{question.difficulty}</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <PlatformBadgeList
                            platforms={question.platforms}
                            fallbackPlatform={question.platform}
                          />
                          <SourceBadge source={question.capturedByExtension ? "extension" : "manual"} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {question.neededHint ? <Badge tone="blue">Needed hint</Badge> : null}
                          {question.neededSolution ? <Badge tone="blue">Needed solution</Badge> : null}
                          {!question.neededHint && !question.neededSolution ? (
                            <Badge>No help needed</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4 xl:min-w-[32rem]">
                      <QuestionMetric label="Score" value={Math.round(question.weaknessScore)} />
                      <QuestionMetric label="Confidence" value={`${question.confidence}/5`} />
                      <QuestionMetric label="Revisions" value={question.revisionCount} />
                      <QuestionMetric label="Last revised" value={formatDate(question.lastRevisedAt)} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <Button href={`/questions/${question._id}`} variant="secondary">
                      View Details
                    </Button>
                    <Button href={`/questions/${question._id}`}>Open</Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="border-t border-slate-200 px-5 py-4 text-center text-sm text-slate-500 sm:px-6">
              Showing 1-{displayedQuestions.length} of {totalDisplayed} questions
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">Bank Insights</p>
                  <p className="mt-1 text-sm text-slate-500">A quick read of your status distribution.</p>
                </div>
                <div
                  className="h-16 w-16 rounded-full"
                  style={{
                    background: `conic-gradient(#ef4444 0deg ${(summary.Red / Math.max(totalInspected, 1)) * 360}deg, #f97316 ${(summary.Red / Math.max(totalInspected, 1)) * 360}deg ${((summary.Red + summary.Orange) / Math.max(totalInspected, 1)) * 360}deg, #fbbf24 ${((summary.Red + summary.Orange) / Math.max(totalInspected, 1)) * 360}deg ${((summary.Red + summary.Orange + summary.Yellow) / Math.max(totalInspected, 1)) * 360}deg, #22c55e ${((summary.Red + summary.Orange + summary.Yellow) / Math.max(totalInspected, 1)) * 360}deg 360deg)`,
                  }}
                >
                  <div className="m-3 h-10 w-10 rounded-full bg-white" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <InsightRow label="Red Zone" value={summary.Red} color="bg-red-500" total={totalInspected} />
                <InsightRow label="Orange Zone" value={summary.Orange} color="bg-orange-500" total={totalInspected} />
                <InsightRow label="Yellow Zone" value={summary.Yellow} color="bg-amber-400" total={totalInspected} />
                <InsightRow label="Green Zone" value={summary.Green} color="bg-emerald-500" total={totalInspected} />
              </div>
            </Card>

            <Card className="rounded-[28px] p-5">
              <p className="text-base font-semibold text-slate-950">Quick Actions</p>
              <div className="mt-4 space-y-3">
                <QuickAction href="/daily" label="Review Daily Queue" />
                <QuickAction href="/questions?status=Red" label="Practice Weak Questions" />
                <QuickAction href="/questions?sortBy=lastRevisedAt" label="View Revision History" />
              </div>
            </Card>

            <Card className="rounded-[28px] border-blue-100 bg-[linear-gradient(135deg,rgba(239,246,255,1),rgba(255,255,255,1))] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-950">Pro Tip</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Focus on weak questions daily. Small, consistent review beats occasional marathon sessions.
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white">
                  <SparkIcon />
                </div>
              </div>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  accent,
  status,
}: {
  label: string;
  value: number;
  note: string;
  accent: string;
  status?: Question["status"];
}) {
  return (
    <Card className={`rounded-[24px] border bg-gradient-to-br p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] ${accent}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/70 bg-white/80 text-slate-900 shadow-sm">
          {getStatusIcon(status)}
        </div>
      </div>
      <p className="mt-5 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </Card>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        isActive
          ? "bg-blue-50 text-blue-700 shadow-sm"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function QuestionMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InsightRow({
  label,
  value,
  color,
  total,
}: {
  label: string;
  value: number;
  color: string;
  total: number;
}) {
  const percentage = total === 0 ? 0 : Math.round((value / total) * 100);

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-3 text-slate-600">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
        <span>{label}</span>
      </div>
      <span className="font-medium text-slate-900">
        {value} ({percentage}%)
      </span>
    </div>
  );
}

function QuickAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
    >
      <span>{label}</span>
      <ArrowRightIcon />
    </Link>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
      <path d="m12 4 7 4-7 4-7-4 7-4Z" />
      <path d="m5 12 7 4 7-4" />
      <path d="m5 16 7 4 7-4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path d="M12 3.5 14 9l5.5 2-5.5 2L12 18.5 10 13 4.5 11 10 9 12 3.5Z" />
    </svg>
  );
}

function RedZoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7 text-red-600">
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function OrangeZoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7 text-orange-600">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5M12 16h.01" />
    </svg>
  );
}

function YellowZoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7 text-amber-600">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  );
}

function GreenZoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7 text-emerald-600">
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
      <path d="m8.5 12 2.2 2.2 4.8-4.9" />
    </svg>
  );
}
