"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { Input } from "@/app/_components/Input";
import { LoadingState } from "@/app/_components/LoadingState";
import { PageHeader } from "@/app/_components/PageHeader";
import { Select } from "@/app/_components/Select";
import { Textarea } from "@/app/_components/Textarea";
import type { Question } from "@/app/_types/question";

type DailyResponse = {
  date: string;
  questions: Question[];
};

type RevisionForm = {
  solvedWithoutHelp: string;
  neededHint: string;
  neededSolution: string;
  confidenceAfter: string;
  feltDifficultyAfter: string;
  timeTakenMinutes: string;
  mistakeNotes: string;
};

const scoreOptions = ["1", "2", "3", "4", "5"];

const initialRevisionForm: RevisionForm = {
  solvedWithoutHelp: "true",
  neededHint: "false",
  neededSolution: "false",
  confidenceAfter: "3",
  feltDifficultyAfter: "3",
  timeTakenMinutes: "",
  mistakeNotes: "",
};

async function fetchDailyData() {
  const response = await fetch("/api/daily");
  const data = (await response.json()) as DailyResponse | { error: string };

  if (!response.ok || !("questions" in data)) {
    throw new Error("error" in data ? data.error : "Failed to load Daily 5.");
  }

  return data;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function DailyClient() {
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [revisionForm, setRevisionForm] = useState<RevisionForm>(initialRevisionForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revisionError, setRevisionError] = useState("");

  useEffect(() => {
    async function loadDaily() {
      try {
        setDaily(await fetchDailyData());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load Daily 5.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDaily();
  }, []);

  function openRevisionForm(question: Question) {
    setActiveQuestionId(question._id);
    setRevisionError("");
    setRevisionForm({
      solvedWithoutHelp: "true",
      neededHint: "false",
      neededSolution: "false",
      confidenceAfter: String(question.confidence),
      feltDifficultyAfter: String(question.feltDifficulty),
      timeTakenMinutes: "",
      mistakeNotes: "",
    });
  }

  async function handleRevisionSubmit(event: FormEvent<HTMLFormElement>, questionId: string) {
    event.preventDefault();
    setIsSubmitting(true);
    setRevisionError("");

    try {
      const response = await fetch(`/api/questions/${questionId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solvedWithoutHelp: revisionForm.solvedWithoutHelp === "true",
          neededHint: revisionForm.neededHint === "true",
          neededSolution: revisionForm.neededSolution === "true",
          confidenceAfter: Number(revisionForm.confidenceAfter),
          feltDifficultyAfter: Number(revisionForm.feltDifficultyAfter),
          timeTakenMinutes: revisionForm.timeTakenMinutes
            ? Number(revisionForm.timeTakenMinutes)
            : undefined,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily 5"
        description={daily ? `Revision set for ${daily.date}.` : undefined}
        actions={
          <Button href="/questions/new" variant="secondary">
            Add question
          </Button>
        }
      />

      {!daily || daily.questions.length === 0 ? (
        <EmptyState
          title="No daily questions yet"
          description="Add at least one solved question to generate a revision list."
          action={<Button href="/questions/new">Add question</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {daily.questions.map((question, index) => (
            <Card key={question._id} className="p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Question {index + 1}</p>
                  <Link
                    href={`/questions/${question._id}`}
                    className="mt-1 block text-lg font-semibold text-slate-950 hover:text-slate-700"
                  >
                    {question.name}
                  </Link>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
                    <Badge>{question.topic}</Badge>
                    <Badge>{question.difficulty}</Badge>
                  </div>
                  {question.selectionReasons && question.selectionReasons.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {question.selectionReasons.map((reason) => (
                        <Badge key={reason} tone="blue">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {question.link ? (
                    <a
                      href={question.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                    >
                      Open question link
                    </a>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[34rem]">
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
                    <p className="text-xs text-slate-500">Revised</p>
                    <p className="font-semibold text-slate-950">{question.revisionCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Last revised</p>
                    <p className="font-semibold text-slate-950">
                      {formatDate(question.lastRevisedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button href={`/questions/${question._id}`} variant="secondary">
                  View details
                </Button>
                <Button type="button" onClick={() => openRevisionForm(question)}>
                  Mark Revised
                </Button>
              </div>

              {activeQuestionId === question._id ? (
                <form
                  onSubmit={(event) => handleRevisionSubmit(event, question._id)}
                  className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <Select
                      label="Solved without help"
                      value={revisionForm.solvedWithoutHelp}
                      onChange={(event) =>
                        setRevisionForm((current) => ({
                          ...current,
                          solvedWithoutHelp: event.target.value,
                        }))
                      }
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                    <Select
                      label="Needed hint"
                      value={revisionForm.neededHint}
                      onChange={(event) =>
                        setRevisionForm((current) => ({
                          ...current,
                          neededHint: event.target.value,
                        }))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                    <Select
                      label="Needed solution"
                      value={revisionForm.neededSolution}
                      onChange={(event) =>
                        setRevisionForm((current) => ({
                          ...current,
                          neededSolution: event.target.value,
                        }))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                    <Select
                      label="New confidence"
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
                      label="New felt difficulty"
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
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {revisionError}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setActiveQuestionId(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : "Submit revision"}
                    </Button>
                  </div>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
