"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/app/_components/Button";
import { Card } from "@/app/_components/Card";
import { Input } from "@/app/_components/Input";
import { Select } from "@/app/_components/Select";
import { Textarea } from "@/app/_components/Textarea";

type FormState = {
  name: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  link: string;
  feltDifficulty: string;
  confidence: string;
  neededHint: boolean;
  neededSolution: boolean;
  notes: string;
  mistakeNotes: string;
};

const initialState: FormState = {
  name: "",
  topic: "",
  difficulty: "Medium",
  link: "",
  feltDifficulty: "3",
  confidence: "3",
  neededHint: false,
  neededSolution: false,
  notes: "",
  mistakeNotes: "",
};

const scoreOptions = ["1", "2", "3", "4", "5"];

export function QuestionForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateForm<Value extends keyof FormState>(field: Value, value: FormState[Value]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          feltDifficulty: Number(form.feltDifficulty),
          confidence: Number(form.confidence),
        }),
      });
      const data = (await response.json()) as { question?: { _id: string }; error?: string };

      if (!response.ok || !data.question) {
        throw new Error(data.error ?? "Failed to create question.");
      }

      router.push("/questions");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create question.");
    } finally {
      setIsSubmitting(false);
    }
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
            placeholder="Arrays, DP, Graphs"
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
            label="Manual / custom link"
            type="url"
            value={form.link}
            onChange={(event) => updateForm("link", event.target.value)}
          />
          <div>
            <Select
              label="Felt difficulty"
              required
              value={form.feltDifficulty}
              onChange={(event) => updateForm("feltDifficulty", event.target.value)}
            >
              {scoreOptions.map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-slate-500">
              1 means it felt easy, 5 means it felt very hard.
            </p>
          </div>
          <div>
            <Select
              label="Confidence"
              required
              value={form.confidence}
              onChange={(event) => updateForm("confidence", event.target.value)}
            >
              {scoreOptions.map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-slate-500">
              1 means unsure, 5 means you can solve it again comfortably.
            </p>
          </div>
          <Select
            label="Needed hint"
            value={String(form.neededHint)}
            onChange={(event) => updateForm("neededHint", event.target.value === "true")}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </Select>
          <Select
            label="Needed solution"
            value={String(form.neededSolution)}
            onChange={(event) => updateForm("neededSolution", event.target.value === "true")}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </Select>
        </div>

        <p className="-mt-1 text-xs text-slate-500">
          Platform-specific links from extension sync are stored automatically. This field is only
          for a manual or custom fallback link.
        </p>

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
          <Button type="button" href="/questions" variant="secondary">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save question"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
