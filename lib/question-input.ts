import { QUESTION_DIFFICULTIES } from "@/models/Question";
import { normalizePlatforms, type PlatformValue } from "@/lib/platform";
import { normalizeQuestionLinks, type QuestionLinkValue } from "@/lib/question-links";

export type QuestionInput = {
  name?: string;
  topic?: string;
  difficulty?: (typeof QUESTION_DIFFICULTIES)[number];
  platform?: PlatformValue;
  platforms?: PlatformValue[];
  questionLinks?: QuestionLinkValue[];
  link?: string;
  feltDifficulty?: number;
  confidence?: number;
  neededHint?: boolean;
  neededSolution?: boolean;
  revisionCount?: number;
  solvedWithoutHelpCount?: number;
  lastRevisedAt?: Date | null;
  nextReviewAt?: Date | null;
  notes?: string;
  mistakeNotes?: string;
};

type ValidationResult =
  | {
      ok: true;
      data: QuestionInput;
    }
  | {
      ok: false;
      error: string;
    };

const requiredCreateFields = [
  "name",
  "topic",
  "difficulty",
  "feltDifficulty",
  "confidence",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  body: Record<string, unknown>,
  field: keyof QuestionInput,
  required: boolean,
) {
  const value = body[field];

  if (value === undefined || value === null) {
    return required ? { error: `${field} is required.` } : {};
  }

  if (typeof value !== "string") {
    return { error: `${field} must be a string.` };
  }

  const trimmedValue = value.trim();

  if (required && !trimmedValue) {
    return { error: `${field} is required.` };
  }

  return { value: trimmedValue };
}

function readBoolean(body: Record<string, unknown>, field: keyof QuestionInput) {
  const value = body[field];

  if (value === undefined) {
    return {};
  }

  if (typeof value !== "boolean") {
    return { error: `${field} must be a boolean.` };
  }

  return { value };
}

function readNumber(
  body: Record<string, unknown>,
  field: keyof QuestionInput,
  options: {
    required?: boolean;
    min: number;
    max?: number;
  },
) {
  const value = body[field];

  if (value === undefined || value === null) {
    return options.required ? { error: `${field} is required.` } : {};
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { error: `${field} must be a number.` };
  }

  if (value < options.min || (options.max !== undefined && value > options.max)) {
    const range = options.max === undefined ? `at least ${options.min}` : `${options.min} to ${options.max}`;
    return { error: `${field} must be ${range}.` };
  }

  return { value };
}

function readDate(body: Record<string, unknown>, field: keyof QuestionInput) {
  const value = body[field];

  if (value === undefined) {
    return {};
  }

  if (value === null || value === "") {
    return { value: null };
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return { error: `${field} must be a valid date.` };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { error: `${field} must be a valid date.` };
  }

  return { value: date };
}

function readDifficulty(body: Record<string, unknown>, required: boolean) {
  const value = body.difficulty;

  if (value === undefined || value === null) {
    return required ? { error: "difficulty is required." } : {};
  }

  if (typeof value !== "string" || !QUESTION_DIFFICULTIES.includes(value as never)) {
    return { error: "difficulty must be Easy, Medium, or Hard." };
  }

  return { value: value as QuestionInput["difficulty"] };
}

function readPlatform(body: Record<string, unknown>) {
  const value = body.platform;

  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (
    typeof value !== "string" ||
    !["leetcode", "gfg", "neetcode", "tuf", "manual"].includes(value)
  ) {
    return { error: "platform must be leetcode, gfg, neetcode, tuf, or manual." };
  }

  return { value: value as PlatformValue };
}

function readPlatforms(body: Record<string, unknown>) {
  const value = body.platforms;

  if (value === undefined || value === null) {
    return {};
  }

  if (!Array.isArray(value)) {
    return { error: "platforms must be an array." };
  }

  if (!value.every((item) => typeof item === "string")) {
    return { error: "platforms must contain only strings." };
  }

  return { value: normalizePlatforms(value) };
}

function readQuestionLinks(body: Record<string, unknown>) {
  const value = body.questionLinks;

  if (value === undefined || value === null) {
    return {};
  }

  if (!Array.isArray(value)) {
    return { error: "questionLinks must be an array." };
  }

  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { error: "questionLinks must contain objects." };
    }

    if (typeof item.url !== "string") {
      return { error: "questionLinks url must be a string." };
    }

    if (item.platform !== undefined && typeof item.platform !== "string") {
      return { error: "questionLinks platform must be a string." };
    }

    if (item.platformSlug !== undefined && typeof item.platformSlug !== "string") {
      return { error: "questionLinks platformSlug must be a string." };
    }
  }

  return {
    value: normalizeQuestionLinks({
      questionLinks: value as QuestionLinkValue[],
    }),
  };
}

export function validateQuestionInput(body: unknown, options: { partial: boolean }): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const data: QuestionInput = {};
  const requireField = (field: (typeof requiredCreateFields)[number]) =>
    !options.partial && requiredCreateFields.includes(field);

  const name = readString(body, "name", requireField("name"));
  if (name.error) return { ok: false, error: name.error };
  if (name.value !== undefined) data.name = name.value;

  const topic = readString(body, "topic", requireField("topic"));
  if (topic.error) return { ok: false, error: topic.error };
  if (topic.value !== undefined) data.topic = topic.value;

  const difficulty = readDifficulty(body, requireField("difficulty"));
  if (difficulty.error) return { ok: false, error: difficulty.error };
  if (difficulty.value !== undefined) data.difficulty = difficulty.value;

  const platform = readPlatform(body);
  if (platform.error) return { ok: false, error: platform.error };
  if (platform.value !== undefined) data.platform = platform.value;

  const platforms = readPlatforms(body);
  if (platforms.error) return { ok: false, error: platforms.error };
  if (platforms.value !== undefined) data.platforms = platforms.value;

  const questionLinks = readQuestionLinks(body);
  if (questionLinks.error) return { ok: false, error: questionLinks.error };
  if (questionLinks.value !== undefined) data.questionLinks = questionLinks.value;

  for (const field of ["link", "notes", "mistakeNotes"] as const) {
    const result = readString(body, field, false);
    if (result.error) return { ok: false, error: result.error };
    if (result.value !== undefined) data[field] = result.value;
  }

  for (const field of ["feltDifficulty", "confidence"] as const) {
    const result = readNumber(body, field, {
      required: requireField(field),
      min: 1,
      max: 5,
    });
    if (result.error) return { ok: false, error: result.error };
    if (result.value !== undefined) data[field] = result.value;
  }

  for (const field of ["revisionCount", "solvedWithoutHelpCount"] as const) {
    const result = readNumber(body, field, {
      min: 0,
    });
    if (result.error) return { ok: false, error: result.error };
    if (result.value !== undefined) data[field] = result.value;
  }

  for (const field of ["neededHint", "neededSolution"] as const) {
    const result = readBoolean(body, field);
    if (result.error) return { ok: false, error: result.error };
    if (result.value !== undefined) data[field] = result.value;
  }

  for (const field of ["lastRevisedAt", "nextReviewAt"] as const) {
    const result = readDate(body, field);
    if (result.error) return { ok: false, error: result.error };
    if (result.value !== undefined) data[field] = result.value;
  }

  if (options.partial && Object.keys(data).length === 0) {
    return { ok: false, error: "At least one supported field is required." };
  }

  return { ok: true, data };
}
