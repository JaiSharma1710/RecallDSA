import { normalizePlatforms } from "@/lib/platform";
import { normalizeQuestionLinks, type QuestionLinkValue } from "@/lib/question-links";
import { validateQuestionInput, type QuestionInput } from "@/lib/question-input";
import { calculateScoreAndStatus } from "@/lib/scoring";

export type ImportableQuestion = QuestionInput & {
  name: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  feltDifficulty: number;
  confidence: number;
};

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase();
}

export function getQuestionDuplicateKey(name: string, topic: string) {
  return `${normalizeKeyPart(name)}::${normalizeKeyPart(topic)}`;
}

export function parseImportPayload(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "questions" in body &&
    Array.isArray(body.questions)
  ) {
    return body.questions;
  }

  return null;
}

export function validateImportQuestion(rawQuestion: unknown) {
  const result = validateQuestionInput(rawQuestion, { partial: false });

  if (!result.ok) {
    return result;
  }

  const data: ImportableQuestion = {
    name: result.data.name!,
    topic: result.data.topic!,
    difficulty: result.data.difficulty!,
    platform: result.data.platform ?? "manual",
    platforms: normalizePlatforms(result.data.platforms, result.data.platform ?? "manual"),
    questionLinks: normalizeQuestionLinks({
      questionLinks: result.data.questionLinks,
      platforms: result.data.platforms,
      fallbackPlatform: result.data.platform ?? "manual",
      link: result.data.link ?? "",
    }),
    feltDifficulty: result.data.feltDifficulty!,
    confidence: result.data.confidence!,
    link: result.data.link ?? "",
    neededHint: result.data.neededHint ?? false,
    neededSolution: result.data.neededSolution ?? false,
    revisionCount: result.data.revisionCount ?? 0,
    solvedWithoutHelpCount: result.data.solvedWithoutHelpCount ?? 0,
    lastRevisedAt: result.data.lastRevisedAt ?? null,
    nextReviewAt: result.data.nextReviewAt ?? null,
    notes: result.data.notes ?? "",
    mistakeNotes: result.data.mistakeNotes ?? "",
  };

  return {
    ok: true as const,
    data,
  };
}

export function buildImportedQuestion(question: ImportableQuestion) {
  return {
    ...question,
    ...calculateScoreAndStatus({
      feltDifficulty: question.feltDifficulty,
      neededHint: question.neededHint ?? false,
      neededSolution: question.neededSolution ?? false,
      confidence: question.confidence,
      revisionCount: question.revisionCount ?? 0,
      solvedWithoutHelpCount: question.solvedWithoutHelpCount ?? 0,
      lastRevisedAt: question.lastRevisedAt ?? null,
    }),
    isArchived: false,
  };
}

export function buildExportQuestion(question: {
  name: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  platform?: string;
  platforms?: string[];
  questionLinks?: QuestionLinkValue[];
  link?: string;
  feltDifficulty: number;
  confidence: number;
  neededHint: boolean;
  neededSolution: boolean;
  revisionCount: number;
  solvedWithoutHelpCount: number;
  lastRevisedAt?: Date | string | null;
  nextReviewAt?: Date | string | null;
  notes?: string;
  mistakeNotes?: string;
}) {
  return {
    name: question.name,
    topic: question.topic,
    difficulty: question.difficulty,
    platform: question.platform ?? "manual",
    platforms: normalizePlatforms(question.platforms, question.platform ?? "manual"),
    questionLinks: normalizeQuestionLinks({
      questionLinks: question.questionLinks,
      platforms: question.platforms,
      fallbackPlatform: question.platform ?? "manual",
      link: question.link ?? "",
    }),
    link: question.link ?? "",
    feltDifficulty: question.feltDifficulty,
    confidence: question.confidence,
    neededHint: question.neededHint,
    neededSolution: question.neededSolution,
    revisionCount: question.revisionCount,
    solvedWithoutHelpCount: question.solvedWithoutHelpCount,
    lastRevisedAt: question.lastRevisedAt ?? null,
    nextReviewAt: question.nextReviewAt ?? null,
    notes: question.notes ?? "",
    mistakeNotes: question.mistakeNotes ?? "",
  };
}
