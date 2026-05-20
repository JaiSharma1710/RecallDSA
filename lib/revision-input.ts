import { normalizePlatform } from "@/lib/platform";
import { QUESTION_PLATFORMS } from "@/models/Question";

export type RevisionInput = {
  solvedWithoutHelp: boolean;
  neededHint: boolean;
  neededSolution: boolean;
  confidenceAfter: number;
  feltDifficultyAfter: number;
  timeTakenMinutes?: number;
  platform?: (typeof QUESTION_PLATFORMS)[number];
  sourceUrl?: string;
  platformSlug?: string;
  source?: string;
  notes?: string;
  mistakeNotes?: string;
};

type ValidationResult =
  | {
      ok: true;
      data: RevisionInput;
    }
  | {
      ok: false;
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(body: Record<string, unknown>, field: keyof RevisionInput) {
  const value = body[field];

  if (value === undefined) {
    return { error: `${field} is required.` };
  }

  if (typeof value !== "boolean") {
    return { error: `${field} must be a boolean.` };
  }

  return { value };
}

function readNumber(
  body: Record<string, unknown>,
  field: keyof RevisionInput,
  options: {
    required: boolean;
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
    const range =
      options.max === undefined ? `at least ${options.min}` : `${options.min} to ${options.max}`;
    return { error: `${field} must be ${range}.` };
  }

  return { value };
}

function readString(body: Record<string, unknown>, field: keyof RevisionInput) {
  const value = body[field];

  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "string") {
    return { error: `${field} must be a string.` };
  }

  return { value: value.trim() };
}

function readPlatform(body: Record<string, unknown>) {
  const value = body.platform;

  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (typeof value !== "string" || !QUESTION_PLATFORMS.includes(value as never)) {
    return { error: "platform must be leetcode, gfg, neetcode, tuf, or manual." };
  }

  return { value: normalizePlatform(value) as RevisionInput["platform"] };
}

export function validateRevisionInput(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const solvedWithoutHelp = readBoolean(body, "solvedWithoutHelp");
  if (solvedWithoutHelp.error) return { ok: false, error: solvedWithoutHelp.error };

  const neededHint = readBoolean(body, "neededHint");
  if (neededHint.error) return { ok: false, error: neededHint.error };

  const neededSolution = readBoolean(body, "neededSolution");
  if (neededSolution.error) return { ok: false, error: neededSolution.error };

  const confidenceAfter = readNumber(body, "confidenceAfter", {
    required: true,
    min: 1,
    max: 5,
  });
  if (confidenceAfter.error) return { ok: false, error: confidenceAfter.error };

  const feltDifficultyAfter = readNumber(body, "feltDifficultyAfter", {
    required: true,
    min: 1,
    max: 5,
  });
  if (feltDifficultyAfter.error) return { ok: false, error: feltDifficultyAfter.error };

  const timeTakenMinutes = readNumber(body, "timeTakenMinutes", {
    required: false,
    min: 0,
  });
  if (timeTakenMinutes.error) return { ok: false, error: timeTakenMinutes.error };

  const platform = readPlatform(body);
  if (platform.error) return { ok: false, error: platform.error };

  const mistakeNotes = readString(body, "mistakeNotes");
  if (mistakeNotes.error) return { ok: false, error: mistakeNotes.error };

  const sourceUrl = readString(body, "sourceUrl");
  if (sourceUrl.error) return { ok: false, error: sourceUrl.error };

  const platformSlug = readString(body, "platformSlug");
  if (platformSlug.error) return { ok: false, error: platformSlug.error };

  const source = readString(body, "source");
  if (source.error) return { ok: false, error: source.error };

  const notes = readString(body, "notes");
  if (notes.error) return { ok: false, error: notes.error };

  return {
    ok: true,
    data: {
      solvedWithoutHelp: solvedWithoutHelp.value!,
      neededHint: neededHint.value!,
      neededSolution: neededSolution.value!,
      confidenceAfter: confidenceAfter.value!,
      feltDifficultyAfter: feltDifficultyAfter.value!,
      timeTakenMinutes: timeTakenMinutes.value,
      platform: platform.value,
      sourceUrl: sourceUrl.value,
      platformSlug: platformSlug.value,
      source: source.value,
      notes: notes.value,
      mistakeNotes: mistakeNotes.value,
    },
  };
}
