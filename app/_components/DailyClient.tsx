"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import toast from "react-hot-toast";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { Input } from "@/app/_components/Input";
import { LoadingState } from "@/app/_components/LoadingState";
import { QuestionLinksModal } from "@/app/_components/QuestionLinksModal";
import { PlatformBadgeList } from "@/app/_components/PlatformBadgeList";
import { Select } from "@/app/_components/Select";
import { Textarea } from "@/app/_components/Textarea";
import type { Question, QuestionLink } from "@/app/_types/question";
import { getQuestionLinkChoices } from "@/lib/question-links";
import { PLATFORM_OPTIONS, normalizePlatforms } from "@/lib/platform";

type DailyQuestion = Question & {
  completedToday: boolean;
  selectionReasons: string[];
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

type RevisionForm = {
  solveStatus: string;
  confidenceAfter: string;
  feltDifficultyAfter: string;
  timeTakenMinutes: string;
  platform: string;
  notes: string;
  mistakeNotes: string;
};

type DailyAction = "generate" | "extend";

const scoreOptions = ["1", "2", "3", "4", "5"];

const initialRevisionForm: RevisionForm = {
  solveStatus: "solved_without_help",
  confidenceAfter: "3",
  feltDifficultyAfter: "3",
  timeTakenMinutes: "",
  platform: "manual",
  notes: "",
  mistakeNotes: "",
};

function getDefaultPlatform(question: Question) {
  const normalizedPlatforms = normalizePlatforms(question.platforms, question.platform);
  return normalizedPlatforms.find((platform) => platform !== "manual") ?? question.platform ?? "manual";
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

async function fetchDailyData() {
  const response = await fetch("/api/daily");
  const data = (await response.json()) as DailyResponse | { error: string };

  if (!response.ok || !("date" in data)) {
    throw new Error("error" in data ? data.error : "Failed to load Daily 5.");
  }

  return data;
}

async function postDailyAction(action: DailyAction) {
  const response = await fetch("/api/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = (await response.json()) as DailyResponse | { error?: string; code?: string };

  if (!response.ok || !("date" in data)) {
    const error = "error" in data ? data.error ?? "Request failed." : "Request failed.";
    const code = "code" in data ? data.code : undefined;
    throw new Error(code ? `${code}::${error}` : error);
  }

  return data;
}

function parseDailyActionError(message: string) {
  const [code, ...rest] = message.split("::");

  if (rest.length === 0) {
    return { code: "", message };
  }

  return {
    code,
    message: rest.join("::"),
  };
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getAverageConfidence(questions: DailyQuestion[]) {
  if (questions.length === 0) {
    return 0;
  }

  return questions.reduce((sum, question) => sum + question.confidence, 0) / questions.length;
}

function getPendingQuestion(questions: DailyQuestion[]) {
  return questions.find((question) => !question.completedToday) ?? null;
}

function getDailyHeroMessage(daily: DailyResponse) {
  if (daily.needsGeneration) {
    return "Lock today’s revision queue once, then work through it without the list reshuffling on every new solve.";
  }

  if (daily.generatedCount === 0) {
    return "No revisions are queued right now.";
  }

  if (daily.completedCount >= daily.generatedCount) {
    return daily.canExtend
      ? "You cleared the current set. Unlock 5 more whenever you want another round today."
      : "Excellent work. Today’s revision set is fully complete.";
  }

  return `${daily.remainingCount} revision${daily.remainingCount === 1 ? "" : "s"} left to finish today’s focus set.`;
}

function getQuestionCoaching(question: DailyQuestion) {
  if (question.completedToday) {
    return {
      title: "Revised today",
      description: "This one is safely checked off for today. Great job keeping the cycle moving.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (question.confidence <= 2) {
    return {
      title: "Confidence is still low",
      description: "Prioritize this one early while the weak spots are easiest to notice.",
      tone: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (question.status === "Red" || question.status === "Orange") {
    return {
      title: "High-impact revision",
      description: "This question offers the biggest payoff if you revisit it now.",
      tone: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  if (question.status === "Yellow") {
    return {
      title: "Good time for a refresh",
      description: "A quick pass here should keep the memory from fading.",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    title: "Confidence-maintenance pass",
    description: "This is more of a light reinforcement rep to keep recall sharp.",
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

function getCardClasses(question: DailyQuestion) {
  if (question.completedToday) {
    return "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.95),rgba(255,255,255,1))] shadow-[0_24px_70px_-42px_rgba(16,185,129,0.45)]";
  }

  return "border-slate-200 bg-white shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]";
}

function ProgressRing({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className="grid h-24 w-24 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#4f86ff ${safeValue}%, rgba(79, 134, 255, 0.12) ${safeValue}% 100%)`,
      }}
    >
      <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-white text-blue-600 shadow-inner">
        <CheckIcon />
      </div>
    </div>
  );
}

export function DailyClient() {
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [linkQuestion, setLinkQuestion] = useState<DailyQuestion | null>(null);
  const [revisionForm, setRevisionForm] = useState<RevisionForm>(initialRevisionForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revisionError, setRevisionError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    fetchDailyData()
      .then((data) => {
        if (!isCancelled) {
          setDaily(data);
        }
      })
      .catch((loadError) => {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load Daily 5.");
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

  async function handleDailyAction(action: DailyAction) {
    setIsGenerating(true);

    try {
      const nextDaily = await postDailyAction(action);
      setDaily(nextDaily);
      toast.success(
        action === "generate"
          ? "Today’s revision set is ready."
          : "5 more revision questions unlocked.",
      );
    } catch (actionError) {
      const { code, message } = parseDailyActionError(
        actionError instanceof Error ? actionError.message : "Request failed.",
      );

      if (code === "ALREADY_GENERATED") {
        toast("Today’s revision set is already locked in.");
      } else if (code === "EXTEND_NOT_READY") {
        toast.error("Finish the current revision set before unlocking 5 more.");
      } else if (code === "NO_MORE_QUESTIONS") {
        toast("No more eligible questions are left to add today.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function openRevisionForm(question: DailyQuestion) {
    if (question.completedToday) {
      return;
    }

    setActiveQuestionId(question._id);
    setRevisionError("");
    setRevisionForm({
      solveStatus: "solved_without_help",
      confidenceAfter: String(question.confidence),
      feltDifficultyAfter: String(question.feltDifficulty),
      timeTakenMinutes: "",
      platform: getDefaultPlatform(question),
      notes: "",
      mistakeNotes: "",
    });
  }

  async function handleRevisionSubmit(event: FormEvent<HTMLFormElement>, questionId: string) {
    event.preventDefault();
    setIsSubmitting(true);
    setRevisionError("");

    try {
      const solvedWithoutHelp = revisionForm.solveStatus === "solved_without_help";
      const neededHint = revisionForm.solveStatus === "needed_hint";
      const neededSolution = revisionForm.solveStatus === "needed_solution";
      const response = await fetch(`/api/questions/${questionId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solvedWithoutHelp,
          neededHint,
          neededSolution,
          confidenceAfter: Number(revisionForm.confidenceAfter),
          feltDifficultyAfter: Number(revisionForm.feltDifficultyAfter),
          timeTakenMinutes: revisionForm.timeTakenMinutes
            ? Number(revisionForm.timeTakenMinutes)
            : undefined,
          platform: revisionForm.platform,
          notes: revisionForm.notes || undefined,
          mistakeNotes: revisionForm.mistakeNotes || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save revision.");
      }

      setDaily(await fetchDailyData());
      setActiveQuestionId(null);
      setRevisionForm(initialRevisionForm);
      toast.success("Revision saved.");
    } catch (submitError) {
      setRevisionError(
        submitError instanceof Error ? submitError.message : "Failed to save revision.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading Daily 5" />;
  }

  if (error) {
    return <EmptyState title="Could not load Daily 5" description={error} />;
  }

  if (!daily) {
    return <EmptyState title="Could not load Daily 5" description="No session data found." />;
  }

  const averageConfidence = getAverageConfidence(daily.questions);
  const firstPendingQuestion = getPendingQuestion(daily.questions);
  const progressValue =
    daily.generatedCount === 0 ? 0 : (daily.completedCount / daily.generatedCount) * 100;

  return (
    <div className="relative space-y-7">
      <QuestionLinksModal
        isOpen={linkQuestion !== null}
        questionId={linkQuestion?._id ?? ""}
        questionName={linkQuestion?.name ?? ""}
        links={linkQuestion ? getQuestionLinks(linkQuestion) : []}
        onClose={() => setLinkQuestion(null)}
      />

      <div className={daily.needsGeneration ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="relative overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.65),_rgba(255,255,255,0.96)_38%,_rgba(239,246,255,0.78)_100%)] p-6 shadow-[0_30px_100px_-44px_rgba(15,23,42,0.38)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),transparent_40%,rgba(191,219,254,0.24))]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
            <section className="space-y-6">
              <div className="space-y-4">
                <span className="inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                  Daily Revision Session
                </span>
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                    Daily 5
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-slate-600">
                    {daily.needsGeneration ? (
                      <>
                        Generate today’s revision queue once for{" "}
                        <span className="font-semibold text-slate-950">{daily.date}</span>, then
                        work from a stable list all day without reshuffling.
                      </>
                    ) : (
                      <>
                        Your locked revision set for{" "}
                        <span className="font-semibold text-slate-950">{daily.date}</span>.{" "}
                        {getDailyHeroMessage(daily)}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {daily.needsGeneration ? (
                  <Button type="button" onClick={() => void handleDailyAction("generate")}>
                    Generate Today’s Queue
                  </Button>
                ) : firstPendingQuestion ? (
                  <Button href={`/questions/${firstPendingQuestion._id}`}>
                    Start With Next Pending
                  </Button>
                ) : (
                  <Button href="/questions" variant="secondary">
                    Current Set Complete
                  </Button>
                )}

                {daily.canExtend ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleDailyAction("extend")}
                  >
                    Unlock Next 5
                  </Button>
                ) : null}

                <Button href="/questions" variant="secondary">
                  Open Question Bank
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DailyMetricTile
                  label="Session Size"
                  value={daily.generatedCount}
                  note={daily.needsGeneration ? "not generated yet" : "locked for today"}
                  tone="from-blue-100 to-slate-50 text-blue-600"
                  icon={<CalendarIcon />}
                />
                <DailyMetricTile
                  label="Completed"
                  value={daily.completedCount}
                  note={daily.completedCount === daily.generatedCount ? "set complete" : "done so far"}
                  tone="from-emerald-100 to-slate-50 text-emerald-600"
                  icon={<CheckCircleIcon />}
                />
                <DailyMetricTile
                  label="Still Due"
                  value={daily.remainingCount}
                  note={daily.remainingCount === 0 ? "nothing pending" : "left for today"}
                  tone="from-amber-100 to-slate-50 text-amber-600"
                  icon={<ClockIcon />}
                />
                <DailyMetricTile
                  label="Avg Confidence"
                  value={averageConfidence.toFixed(1)}
                  suffix="/ 5"
                  note={daily.needsGeneration ? "will appear after generation" : "across current batch"}
                  tone="from-violet-100 to-slate-50 text-violet-600"
                  icon={<TrendIcon />}
                />
              </div>
            </section>

            <Card className="rounded-[28px] border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-34px_rgba(15,23,42,0.28)] backdrop-blur">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-medium text-slate-500">Today’s Revision Progress</p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="text-5xl font-semibold tracking-tight text-slate-950">
                      {daily.completedCount}
                    </span>
                    <span className="pb-1 text-2xl text-slate-400">/ {daily.generatedCount}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {daily.needsGeneration ? "Generate the queue to begin." : "Questions revised today"}
                  </p>
                </div>
                <ProgressRing value={progressValue} />
              </div>

              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#4f86ff_0%,#7aa2ff_100%)] transition-all"
                  style={{ width: `${progressValue}%` }}
                />
              </div>

              <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-slate-700">How this session works</p>
                <ul className="space-y-2 text-sm leading-6 text-slate-500">
                  <li>Generate once per day to lock a stable revision list.</li>
                  <li>Completed cards turn green so you can instantly see what is done.</li>
                  <li>After finishing the full batch, you can unlock 5 more using the same priority logic.</li>
                </ul>
              </div>
            </Card>
          </div>
        </div>

        {!daily.needsGeneration ? (
          <div className="mt-7 grid gap-5">
            {daily.questions.map((question, index) => {
              const coaching = getQuestionCoaching(question);
              const questionLinks = getQuestionLinks(question);

              return (
                <Card
                  key={question._id}
                  className={`rounded-[28px] p-5 sm:p-6 ${getCardClasses(question)}`}
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-semibold ${
                            question.completedToday
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {question.completedToday ? <CheckIcon /> : index + 1}
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-500">Question {index + 1}</p>
                            <Link
                              href={`/questions/${question._id}`}
                              className="block text-2xl font-semibold tracking-tight text-slate-950 hover:text-slate-700"
                            >
                              {question.name}
                            </Link>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
                            <Badge>{question.topic}</Badge>
                            <Badge>{question.difficulty}</Badge>
                            {question.completedToday ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                Revised today
                              </span>
                            ) : null}
                          </div>

                          <PlatformBadgeList
                            platforms={question.platforms}
                            fallbackPlatform={question.platform}
                          />

                          {question.selectionReasons && question.selectionReasons.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {question.selectionReasons.map((reason) => (
                                <Badge key={reason} tone="blue">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4 xl:min-w-[34rem]">
                        <QuestionStat label="Priority score" value={Math.round(question.weaknessScore)} />
                        <QuestionStat label="Confidence" value={`${question.confidence}/5`} />
                        <QuestionStat label="Revision count" value={question.revisionCount} />
                        <QuestionStat label="Last revised" value={formatDate(question.lastRevisedAt)} />
                      </div>
                    </div>

                    <div className={`rounded-2xl border px-4 py-3 ${coaching.tone}`}>
                      <p className="text-sm font-semibold">{coaching.title}</p>
                      <p className="mt-1 text-sm leading-6">{coaching.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {questionLinks.length > 0 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setLinkQuestion(question)}
                        >
                          Open Question
                        </Button>
                      ) : (
                        <Button href={`/questions/${question._id}`} variant="secondary">
                          Open Question
                        </Button>
                      )}
                      <Button href={`/questions/${question._id}`} variant="secondary">
                        View Details
                      </Button>
                      {question.completedToday ? (
                        <Button type="button" disabled className="bg-emerald-600 hover:bg-emerald-600">
                          Revised Today
                        </Button>
                      ) : (
                        <Button type="button" onClick={() => openRevisionForm(question)}>
                          Mark Revised
                        </Button>
                      )}
                    </div>

                    {activeQuestionId === question._id ? (
                      <form
                        onSubmit={(event) => handleRevisionSubmit(event, question._id)}
                        className="rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5"
                      >
                        <div className="grid gap-4 md:grid-cols-3">
                          <Select
                            label="Solve status"
                            value={revisionForm.solveStatus}
                            onChange={(event) =>
                              setRevisionForm((current) => ({
                                ...current,
                                solveStatus: event.target.value,
                              }))
                            }
                          >
                            <option value="solved_without_help">Solved without help</option>
                            <option value="needed_hint">Needed hint</option>
                            <option value="needed_solution">Needed solution</option>
                          </Select>
                          <Select
                            label="Updated confidence"
                            value={revisionForm.confidenceAfter}
                            onChange={(event) =>
                              setRevisionForm((current) => ({
                                ...current,
                                confidenceAfter: event.target.value,
                              }))
                            }
                          >
                            {scoreOptions.map((score) => (
                              <option key={score} value={score}>
                                {score}
                              </option>
                            ))}
                          </Select>
                          <Select
                            label="Updated difficulty"
                            value={revisionForm.feltDifficultyAfter}
                            onChange={(event) =>
                              setRevisionForm((current) => ({
                                ...current,
                                feltDifficultyAfter: event.target.value,
                              }))
                            }
                          >
                            {scoreOptions.map((score) => (
                              <option key={score} value={score}>
                                {score}
                              </option>
                            ))}
                          </Select>
                          <Input
                            label="Time taken"
                            type="number"
                            min={0}
                            placeholder="Minutes"
                            value={revisionForm.timeTakenMinutes}
                            onChange={(event) =>
                              setRevisionForm((current) => ({
                                ...current,
                                timeTakenMinutes: event.target.value,
                              }))
                            }
                          />
                          <Select
                            label="Solved on platform"
                            value={revisionForm.platform}
                            onChange={(event) =>
                              setRevisionForm((current) => ({
                                ...current,
                                platform: event.target.value,
                              }))
                            }
                          >
                            {PLATFORM_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="mt-4">
                          <Textarea
                            label="Notes"
                            value={revisionForm.notes}
                            onChange={(event) =>
                              setRevisionForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="mt-4">
                          <Textarea
                            label="Mistake notes"
                            value={revisionForm.mistakeNotes}
                            onChange={(event) =>
                              setRevisionForm((current) => ({
                                ...current,
                                mistakeNotes: event.target.value,
                              }))
                            }
                          />
                        </div>

                        {revisionError ? (
                          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {revisionError}
                          </div>
                        ) : null}

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setActiveQuestionId(null)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Revision"}
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>

      {daily.needsGeneration ? (
        <GenerateDailyModal
          date={daily.date}
          isSubmitting={isGenerating}
          onGenerate={() => void handleDailyAction("generate")}
        />
      ) : null}
    </div>
  );
}

function GenerateDailyModal({
  date,
  isSubmitting,
  onGenerate,
}: {
  date: string;
  isSubmitting: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_100px_-35px_rgba(15,23,42,0.45)] sm:p-8">
        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Daily Revision Generator
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Generate today’s revision queue
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-600">
          We’ll lock a stable set for <span className="font-semibold text-slate-950">{date}</span> so
          your revision flow stays consistent all day, even if you solve new questions later.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <ul className="space-y-2 text-sm leading-6 text-slate-500">
            <li>Starts with your top 5 highest-priority revision picks.</li>
            <li>Uses current weakness, confidence, recency, and past struggle signals.</li>
            <li>After finishing the set, you can unlock the next 5.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" onClick={onGenerate} disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : "Generate Questions"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DailyMetricTile({
  label,
  value,
  suffix,
  note,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  note: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${tone}`}>
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
        {suffix ? <span className="pb-1 text-lg text-slate-400">{suffix}</span> : null}
      </div>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function QuestionStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M7 3.75v3.5M17 3.75v3.5M3.5 9.5h17" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.2 2.2 4.8-4.9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.5 2" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path d="M4 16.5 9 11l3.5 3.5L20 7" />
      <path d="M15 7h5v5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5">
      <path d="m6.5 12 3 3L17.5 7.5" />
    </svg>
  );
}
