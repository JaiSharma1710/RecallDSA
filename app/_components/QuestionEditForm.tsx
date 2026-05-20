"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { EmptyState } from "@/app/_components/EmptyState";
import { Input } from "@/app/_components/Input";
import { LoadingState } from "@/app/_components/LoadingState";
import { Select } from "@/app/_components/Select";
import { Textarea } from "@/app/_components/Textarea";
import type { Question } from "@/app/_types/question";

type QuestionResponse = {
  question: Question;
};

type FormState = {
  name: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  link: string;
  feltDifficulty: string;
  confidence: string;
  neededHint: string;
  neededSolution: string;
  notes: string;
  mistakeNotes: string;
};

const scoreOptions = ["1", "2", "3", "4", "5"];

function getFormState(question: Question): FormState {
  return {
    name: question.name,
    topic: question.topic,
    difficulty: question.difficulty,
    link: question.link ?? "",
    feltDifficulty: String(question.feltDifficulty),
    confidence: String(question.confidence),
    neededHint: String(question.neededHint),
    neededSolution: String(question.neededSolution),
    notes: question.notes ?? "",
    mistakeNotes: question.mistakeNotes ?? "",
  };
}

export function QuestionEditForm({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadQuestion() {
      try {
        const response = await fetch(`/api/questions/${questionId}`);
        const data = (await response.json()) as QuestionResponse | { error: string };

        if (!response.ok || !("question" in data)) {
          throw new Error("error" in data ? data.error : "Failed to load question.");
        }

        if (isActive) {
          setForm(getFormState(data.question));
        }
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

  function updateForm<Value extends keyof FormState>(field: Value, value: FormState[Value]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          topic: form.topic,
          difficulty: form.difficulty,
          link: form.link,
          feltDifficulty: Number(form.feltDifficulty),
          confidence: Number(form.confidence),
          neededHint: form.neededHint === "true",
          neededSolution: form.neededSolution === "true",
          notes: form.notes,
          mistakeNotes: form.mistakeNotes,
        }),
      });
      const data = (await response.json()) as { question?: Question; error?: string };

      if (!response.ok || !data.question) {
        throw new Error(data.error ?? "Failed to update question.");
      }

      router.push(`/questions/${questionId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update question.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading question" />;
  }

  if (!form) {
    return <EmptyState title="Could not load question" description={error} />;
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Question name"
            required
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
          />
          <Input
            label="Topic"
            required
            value={form.topic}
            onChange={(event) => updateForm("topic", event.target.value)}
          />
          <Select
            label="Difficulty"
            value={form.difficulty}
            onChange={(event) =>
              updateForm("difficulty", event.target.value as FormState["difficulty"])
            }
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </Select>
          <Input
            label="Question link"
            type="url"
            value={form.link}
            onChange={(event) => updateForm("link", event.target.value)}
          />
          <Select
            label="Felt difficulty"
            value={form.feltDifficulty}
            onChange={(event) => updateForm("feltDifficulty", event.target.value)}
          >
            {scoreOptions.map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </Select>
          <Select
            label="Confidence"
            value={form.confidence}
            onChange={(event) => updateForm("confidence", event.target.value)}
          >
            {scoreOptions.map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </Select>
          <Select
            label="Needed hint"
            value={form.neededHint}
            onChange={(event) => updateForm("neededHint", event.target.value)}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </Select>
          <Select
            label="Needed solution"
            value={form.neededSolution}
            onChange={(event) => updateForm("neededSolution", event.target.value)}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(event) => updateForm("notes", event.target.value)}
          />
          <Textarea
            label="Mistake notes"
            value={form.mistakeNotes}
            onChange={(event) => updateForm("mistakeNotes", event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" href={`/questions/${questionId}`} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
