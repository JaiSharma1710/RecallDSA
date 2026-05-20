import {
  QUESTION_DIFFICULTIES,
  QUESTION_EXTERNAL_STATUSES,
  QUESTION_PLATFORMS,
} from "@/models/Question";

export type ExtensionQuestionInput = {
  name: string;
  platform: (typeof QUESTION_PLATFORMS)[number];
  sourceUrl?: string;
  platformSlug?: string;
  platformProblemId?: string;
  difficulty?: (typeof QUESTION_DIFFICULTIES)[number];
  topic?: string;
  feltDifficulty?: number;
  confidence?: number;
  solveStatus?: "solved_without_help" | "needed_hint" | "needed_solution";
  solvedWithoutHelp?: boolean;
  neededHint?: boolean;
  neededSolution?: boolean;
  timeTakenMinutes?: number;
  notes?: string;
  mistakeNotes?: string;
  capturedByExtension?: boolean;
  externalStatus?: (typeof QUESTION_EXTERNAL_STATUSES)[number];
  pageTitle?: string;
  capturedAt?: Date;
  preparedAt?: Date;
};

type ValidationResult =
  | {
      ok: true;
      data: ExtensionQuestionInput;
    }
  | {
      ok: false;
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  body: Record<string, unknown>,
  field: keyof ExtensionQuestionInput,
  options: { required?: boolean } = {},
) {
  const value = body[field];

  if (value === undefined || value === null) {
    return options.required ? { error: `${field} is required.` } : {};
  }

  if (typeof value !== "string") {
    return { error: `${field} must be a string.` };
  }

  const trimmed = value.trim();

  if (options.required && !trimmed) {
    return { error: `${field} is required.` };
  }

  return { value: trimmed };
}

function readBoolean(body: Record<string, unknown>, field: keyof ExtensionQuestionInput) {
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
  field: keyof ExtensionQuestionInput,
  options: { min: number; max?: number },
) {
  const value = body[field];

  if (value === undefined || value === null || value === "") {
    return {};
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

function readDate(body: Record<string, unknown>, field: keyof ExtensionQuestionInput) {
  const value = body[field];

  if (value === undefined || value === null || value === "") {
    return {};
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

function readDifficulty(body: Record<string, unknown>) {
  const value = body.difficulty;

  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (typeof value !== "string" || !QUESTION_DIFFICULTIES.includes(value as never)) {
    return { error: "difficulty must be Easy, Medium, or Hard." };
  }

  return { value: value as ExtensionQuestionInput["difficulty"] };
}

function readPlatform(body: Record<string, unknown>) {
  const value = body.platform;

  if (typeof value !== "string" || !QUESTION_PLATFORMS.includes(value as never)) {
    return { error: "platform must be leetcode, gfg, neetcode, tuf, or manual." };
  }

  return { value: value as ExtensionQuestionInput["platform"] };
}

function readExternalStatus(body: Record<string, unknown>) {
  const value = body.externalStatus;

  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (
    typeof value !== "string" ||
    !QUESTION_EXTERNAL_STATUSES.includes(value as never)
  ) {
    return {
      error: "externalStatus must be unsolved, attempted, accepted, or unknown.",
    };
  }

  return { value: value as ExtensionQuestionInput["externalStatus"] };
}

function readSolveStatus(body: Record<string, unknown>) {
  const value = body.solveStatus;

  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (
    value !== "solved_without_help" &&
    value !== "needed_hint" &&
    value !== "needed_solution"
  ) {
    return {
      error:
        "solveStatus must be solved_without_help, needed_hint, or needed_solution.",
    };
  }

  return { value };
}

export function validateExtensionQuestionInput(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const name = readString(body, "name", { required: true });
  if (name.error) return { ok: false, error: name.error };

  const platform = readPlatform(body);
  if (platform.error) return { ok: false, error: platform.error };

  const sourceUrl = readString(body, "sourceUrl");
  if (sourceUrl.error) return { ok: false, error: sourceUrl.error };

  const platformSlug = readString(body, "platformSlug");
  if (platformSlug.error) return { ok: false, error: platformSlug.error };

  if (!sourceUrl.value && !platformSlug.value) {
    return { ok: false, error: "sourceUrl or platformSlug is required." };
  }

  const difficulty = readDifficulty(body);
  if (difficulty.error) return { ok: false, error: difficulty.error };

  const topic = readString(body, "topic");
  if (topic.error) return { ok: false, error: topic.error };

  const platformProblemId = readString(body, "platformProblemId");
  if (platformProblemId.error) return { ok: false, error: platformProblemId.error };

  const pageTitle = readString(body, "pageTitle");
  if (pageTitle.error) return { ok: false, error: pageTitle.error };

  const notes = readString(body, "notes");
  if (notes.error) return { ok: false, error: notes.error };

  const mistakeNotes = readString(body, "mistakeNotes");
  if (mistakeNotes.error) return { ok: false, error: mistakeNotes.error };

  const feltDifficulty = readNumber(body, "feltDifficulty", { min: 1, max: 5 });
  if (feltDifficulty.error) return { ok: false, error: feltDifficulty.error };

  const confidence = readNumber(body, "confidence", { min: 1, max: 5 });
  if (confidence.error) return { ok: false, error: confidence.error };

  const timeTakenMinutes = readNumber(body, "timeTakenMinutes", { min: 0 });
  if (timeTakenMinutes.error) return { ok: false, error: timeTakenMinutes.error };

  const solvedWithoutHelp = readBoolean(body, "solvedWithoutHelp");
  if (solvedWithoutHelp.error) return { ok: false, error: solvedWithoutHelp.error };

  const neededHint = readBoolean(body, "neededHint");
  if (neededHint.error) return { ok: false, error: neededHint.error };

  const neededSolution = readBoolean(body, "neededSolution");
  if (neededSolution.error) return { ok: false, error: neededSolution.error };

  const capturedByExtension = readBoolean(body, "capturedByExtension");
  if (capturedByExtension.error) {
    return { ok: false, error: capturedByExtension.error };
  }

  const externalStatus = readExternalStatus(body);
  if (externalStatus.error) return { ok: false, error: externalStatus.error };

  const solveStatus = readSolveStatus(body);
  if (solveStatus.error) return { ok: false, error: solveStatus.error };

  const capturedAt = readDate(body, "capturedAt");
  if (capturedAt.error) return { ok: false, error: capturedAt.error };

  const preparedAt = readDate(body, "preparedAt");
  if (preparedAt.error) return { ok: false, error: preparedAt.error };

  return {
    ok: true,
    data: {
      name: name.value!,
      platform: platform.value!,
      sourceUrl: sourceUrl.value,
      platformSlug: platformSlug.value,
      platformProblemId: platformProblemId.value,
      difficulty: difficulty.value,
      topic: topic.value,
      feltDifficulty: feltDifficulty.value,
      confidence: confidence.value,
      solveStatus: solveStatus.value as ExtensionQuestionInput["solveStatus"],
      solvedWithoutHelp: solvedWithoutHelp.value,
      neededHint: neededHint.value,
      neededSolution: neededSolution.value,
      timeTakenMinutes: timeTakenMinutes.value,
      notes: notes.value,
      mistakeNotes: mistakeNotes.value,
      capturedByExtension: capturedByExtension.value,
      externalStatus: externalStatus.value,
      pageTitle: pageTitle.value,
      capturedAt: capturedAt.value,
      preparedAt: preparedAt.value,
    },
  };
}
