"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Badge, getStatusLabel } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { Input } from "@/app/_components/Input";
import { LoadingState } from "@/app/_components/LoadingState";
import { PageHeader } from "@/app/_components/PageHeader";
import { Textarea } from "@/app/_components/Textarea";
import type { Question, RevisionLog } from "@/app/_types/question";

type QuestionResponse = {
  question: Question;
};

type RevisionsResponse = {
  revisions: RevisionLog[];
};

type RevisionForm = {
  solvedWithoutHelp: boolean;
  neededHint: boolean;
  neededSolution: boolean;
  confidenceAfter: string;
  feltDifficultyAfter: string;
  timeTakenMinutes: string;
  mistakeNotes: string;
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
  const [error, setError] = useState("");
  const [form, setForm] = useState<RevisionForm>({
    solvedWithoutHelp: true,
    neededHint: false,
    neededSolution: false,
    confidenceAfter: "3",
    feltDifficultyAfter: "3",
    timeTakenMinutes: "",
    mistakeNotes: "",
  });

  useEffect(() => {
    let isActive = true;

    async function loadQuestion() {
      try {
        const data = await fetchQuestionData(questionId);

        if (!isActive) {
          return;
        }

        setQuestion(data.question);
        setRevisions(data.revisions);
        setForm((current) => ({
          ...current,
          confidenceAfter: String(data.question.confidence),
          feltDifficultyAfter: String(data.question.feltDifficulty),
        }));
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load question.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadQuestion();

    return () => {
      isActive = false;
    };
  }, [questionId]);

  async function handleRevisionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/questions/${questionId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solvedWithoutHelp: form.solvedWithoutHelp,
          neededHint: form.neededHint,
          neededSolution: form.neededSolution,
          confidenceAfter: Number(form.confidenceAfter),
          feltDifficultyAfter: Number(form.feltDifficultyAfter),
          timeTakenMinutes: form.timeTakenMinutes ? Number(form.timeTakenMinutes) : undefined,
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
        mistakeNotes: "",
      }));
      const refreshedData = await fetchQuestionData(questionId);
      setQuestion(refreshedData.question);
      setRevisions(refreshedData.revisions);
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

  if (isLoading) {
    return <LoadingState label="Loading question" />;
  }

  if (error && !question) {
    return <EmptyState title="Could not load question" description={error} />;
  }

  if (!question) {
    return <EmptyState title="Question not found" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={question.name}
        description={`${question.topic} · ${question.difficulty}`}
        actions={
          <>
            {question.link ? (
              <Button href={question.link} variant="secondary">
                Open link
              </Button>
            ) : null}
            <Button href={`/questions/${questionId}/edit`} variant="secondary">
              Edit question
            </Button>
            <Button type="button" onClick={() => setIsRevisionOpen(true)}>
              Mark revised
            </Button>
            <Button type="button" variant="danger" onClick={handleArchive}>
              Archive question
            </Button>
          </>
        }
      />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Status</p>
          <div className="mt-3">
            <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Weakness score</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {Math.round(question.weaknessScore)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Confidence</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{question.confidence}/5</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Revisions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{question.revisionCount}</p>
        </Card>
      </section>

      <section className="grid gap-6">
        {isRevisionOpen ? (
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-950">Mark revised</h2>
              <Button type="button" variant="ghost" onClick={() => setIsRevisionOpen(false)}>
                Cancel
              </Button>
            </div>
            <form onSubmit={handleRevisionSubmit} className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.solvedWithoutHelp}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        solvedWithoutHelp: event.target.checked,
                      }))
                    }
                  />
                  Solved without help
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.neededHint}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, neededHint: event.target.checked }))
                    }
                  />
                  Needed hint
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.neededSolution}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        neededSolution: event.target.checked,
                      }))
                    }
                  />
                  Needed solution
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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
                  label="Time minutes"
                  type="number"
                  min={0}
                  value={form.timeTakenMinutes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, timeTakenMinutes: event.target.value }))
                  }
                />
              </div>

              <Textarea
                label="Mistake notes"
                value={form.mistakeNotes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mistakeNotes: event.target.value }))
                }
              />

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save revision"}
              </Button>
            </form>
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-950">Details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500">Question name</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Topic</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.topic}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Difficulty</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.difficulty}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Question link</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {question.link ? (
                  <a
                    href={question.link}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                  >
                    Open link
                  </a>
                ) : (
                  "Not added"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Current confidence</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.confidence}/5</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Felt difficulty</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.feltDifficulty}/5</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Weakness score</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {Math.round(question.weaknessScore)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Status</dt>
              <dd className="mt-1">
                <Badge status={question.status}>{getStatusLabel(question.status)}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Revision count</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.revisionCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Last revised</dt>
              <dd className="mt-1 font-medium text-slate-950">{formatDate(question.lastRevisedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Solved without help</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.solvedWithoutHelpCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Needed hint</dt>
              <dd className="mt-1 font-medium text-slate-950">{question.neededHint ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Needed solution</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {question.neededSolution ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
          {question.notes ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-slate-700">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{question.notes}</p>
            </div>
          ) : null}
          {question.mistakeNotes ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-slate-700">Mistake notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {question.mistakeNotes}
              </p>
            </div>
          ) : null}
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-950">Revision history</h2>
        {revisions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No revisions logged yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {revisions.map((revision) => (
              <div key={revision._id} className="py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-slate-950">{formatDate(revision.revisedAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{revision.solvedWithoutHelp ? "Solved without help" : "Used help"}</Badge>
                    <Badge>{revision.neededHint ? "Needed hint" : "No hint"}</Badge>
                    <Badge>{revision.neededSolution ? "Needed solution" : "No solution"}</Badge>
                  </div>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Confidence after</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {revision.confidenceAfter}/5
                    </dd>
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
                </dl>
                {revision.mistakeNotes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {revision.mistakeNotes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
