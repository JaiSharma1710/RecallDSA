import type { QueryFilter } from "mongoose";
import { NextRequest } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { validateExtensionQuestionInput } from "@/lib/extension-input";
import { normalizePlatforms } from "@/lib/platform";
import { calculateScoreAndStatus } from "@/lib/scoring";
import QuestionModel, { type Question } from "@/models/Question";
import RevisionLogModel from "@/models/RevisionLog";

export const dynamic = "force-dynamic";

const EXTENSION_API_KEY = process.env.EXTENSION_API_KEY;
const DEV_ALLOWED_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

function buildCorsHeaders(origin: string | null) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-extension-api-key",
    Vary: "Origin",
  });

  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    headers.set("Access-Control-Allow-Origin", "http://localhost:3000");
  }

  return headers;
}

function jsonResponse(
  body: { success: boolean; message: string; data?: unknown },
  status: number,
  origin: string | null,
) {
  return Response.json(body, {
    status,
    headers: buildCorsHeaders(origin),
  });
}

function isAllowedOrigin(origin: string) {
  return DEV_ALLOWED_ORIGINS.has(origin) || origin.startsWith("chrome-extension://");
}

function isAuthorized(request: NextRequest) {
  if (!EXTENSION_API_KEY) {
    return false;
  }

  const headerApiKey = request.headers.get("x-extension-api-key");
  return headerApiKey === EXTENSION_API_KEY;
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function mergeText(existingValue: string | undefined, nextValue: string | undefined) {
  if (nextValue === undefined) {
    return existingValue ?? "";
  }

  if (!nextValue) {
    return existingValue ?? "";
  }

  const existing = (existingValue ?? "").trim();

  if (!existing) {
    return nextValue;
  }

  if (existing.includes(nextValue)) {
    return existing;
  }

  return `${existing}\n\n${nextValue}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findExistingQuestion(input: {
  platform: Question["platform"];
  platformSlug?: string;
  sourceUrl?: string;
  name: string;
  topic?: string;
}) {
  const lookups: QueryFilter<Question>[] = [];

  if (input.platformSlug) {
    lookups.push({
      isArchived: false,
      platform: input.platform,
      platformSlug: input.platformSlug,
    });
  }

  if (input.sourceUrl) {
    lookups.push({
      isArchived: false,
      $or: [{ sourceUrl: input.sourceUrl }, { link: input.sourceUrl }],
    });
  }

  if (input.topic) {
    lookups.push({
      isArchived: false,
      name: new RegExp(`^${escapeRegex(input.name)}$`, "i"),
      topic: new RegExp(`^${escapeRegex(input.topic)}$`, "i"),
    });
  }

  for (const query of lookups) {
    const question = await QuestionModel.findOne(query);

    if (question) {
      return question;
    }
  }

  return null;
}

function getInputPlatform(input: {
  platform: Question["platform"];
  solvedOnPlatform?: Question["platform"];
}) {
  return input.platform ?? input.solvedOnPlatform ?? "manual";
}

function deriveSolveFlags(input: {
  solveStatus?: "solved_without_help" | "needed_hint" | "needed_solution";
  solvedWithoutHelp?: boolean;
  neededHint?: boolean;
  neededSolution?: boolean;
}) {
  if (input.solveStatus === "solved_without_help") {
    return {
      solvedWithoutHelp: true,
      neededHint: false,
      neededSolution: false,
    };
  }

  if (input.solveStatus === "needed_hint") {
    return {
      solvedWithoutHelp: false,
      neededHint: true,
      neededSolution: false,
    };
  }

  if (input.solveStatus === "needed_solution") {
    return {
      solvedWithoutHelp: false,
      neededHint: false,
      neededSolution: true,
    };
  }

  return {
    solvedWithoutHelp: input.solvedWithoutHelp ?? false,
    neededHint: input.neededHint ?? false,
    neededSolution: input.neededSolution ?? false,
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse({ success: false, message: "Origin not allowed." }, 403, origin);
  }

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    if (origin && !isAllowedOrigin(origin)) {
      return jsonResponse({ success: false, message: "Origin not allowed." }, 403, origin);
    }

    if (!isAuthorized(request)) {
      return jsonResponse({ success: false, message: "Unauthorized." }, 401, origin);
    }

    const body = await readJson(request);
    const result = validateExtensionQuestionInput(body);

    if (!result.ok) {
      return jsonResponse({ success: false, message: result.error }, 400, origin);
    }

    await connectToDatabase();

    const input = result.data;
    const platform = getInputPlatform(input);
    const requestPlatforms = normalizePlatforms([platform]);
    const solveFlags = deriveSolveFlags(input);
    const now = new Date();
    const difficulty = input.difficulty ?? "Medium";
    const topic = input.topic ?? "General";
    const feltDifficulty = input.feltDifficulty ?? 3;
    const confidence = input.confidence ?? 3;

    const existingQuestion = await findExistingQuestion({
      platform,
      platformSlug: input.platformSlug,
      sourceUrl: input.sourceUrl,
      name: input.name,
      topic,
    });

    if (existingQuestion) {
      const existingPlatforms = normalizePlatforms(
        existingQuestion.platforms,
        existingQuestion.platform,
      );
      const nextPlatforms = existingPlatforms.includes(platform)
        ? existingPlatforms
        : [...existingPlatforms, platform];

      const revisionCount = existingQuestion.revisionCount + 1;
      const solvedWithoutHelpCount =
        existingQuestion.solvedWithoutHelpCount + (solveFlags.solvedWithoutHelp ? 1 : 0);

      const scoreAndStatus = calculateScoreAndStatus(
        {
          feltDifficulty,
          neededHint: solveFlags.neededHint,
          neededSolution: solveFlags.neededSolution,
          confidence,
          revisionCount,
          solvedWithoutHelpCount,
          lastRevisedAt: now,
        },
        now,
      );

      existingQuestion.set({
        name: input.name,
        topic: topic || existingQuestion.topic,
        difficulty,
        platform,
        platforms: nextPlatforms,
        ...(input.platformSlug !== undefined ? { platformSlug: input.platformSlug } : {}),
        ...(input.platformProblemId !== undefined
          ? { platformProblemId: input.platformProblemId }
          : {}),
        ...(input.sourceUrl !== undefined
          ? {
              sourceUrl: input.sourceUrl,
              link: input.sourceUrl || existingQuestion.link,
            }
          : {}),
        ...(input.pageTitle !== undefined ? { pageTitle: input.pageTitle } : {}),
        ...(input.externalStatus !== undefined ? { externalStatus: input.externalStatus } : {}),
        capturedByExtension:
          input.capturedByExtension ?? existingQuestion.capturedByExtension ?? true,
        revisionCount,
        solvedWithoutHelpCount,
        feltDifficulty,
        confidence,
        neededHint: solveFlags.neededHint,
        neededSolution: solveFlags.neededSolution,
        lastRevisedAt: now,
        notes: mergeText(existingQuestion.notes, input.notes),
        mistakeNotes: mergeText(existingQuestion.mistakeNotes, input.mistakeNotes),
        ...scoreAndStatus,
      });

      await existingQuestion.save();

      await RevisionLogModel.create({
        questionId: existingQuestion._id,
        revisedAt: now,
        platform,
        sourceUrl: input.sourceUrl ?? existingQuestion.sourceUrl ?? existingQuestion.link ?? "",
        platformSlug: input.platformSlug ?? existingQuestion.platformSlug ?? "",
        solvedWithoutHelp: solveFlags.solvedWithoutHelp,
        neededHint: solveFlags.neededHint,
        neededSolution: solveFlags.neededSolution,
        confidenceAfter: confidence,
        feltDifficultyAfter: feltDifficulty,
        timeTakenMinutes: input.timeTakenMinutes,
        notes: input.notes ?? "",
        mistakeNotes: input.mistakeNotes ?? "",
        source: "extension",
      });

      return jsonResponse(
        {
          success: true,
          message: "Question updated from extension",
          data: existingQuestion,
        },
        200,
        origin,
      );
    }

    const baseQuestion = {
      name: input.name,
      topic,
      difficulty,
      platform,
      platforms: requestPlatforms,
      platformSlug: input.platformSlug ?? "",
      platformProblemId: input.platformProblemId ?? "",
      sourceUrl: input.sourceUrl ?? "",
      link: input.sourceUrl ?? "",
      pageTitle: input.pageTitle ?? "",
      externalStatus: input.externalStatus ?? "unknown",
      capturedByExtension: input.capturedByExtension ?? true,
      feltDifficulty,
      confidence,
      neededHint: solveFlags.neededHint,
      neededSolution: solveFlags.neededSolution,
      revisionCount: 1,
      solvedWithoutHelpCount: solveFlags.solvedWithoutHelp ? 1 : 0,
      lastRevisedAt: now,
      notes: input.notes ?? "",
      mistakeNotes: input.mistakeNotes ?? "",
    };

    const scoreAndStatus = calculateScoreAndStatus(
      {
        ...baseQuestion,
        lastRevisedAt: now,
      },
      now,
    );

    const question = await QuestionModel.create({
      ...baseQuestion,
      ...scoreAndStatus,
    });

    await RevisionLogModel.create({
      questionId: question._id,
      revisedAt: now,
      platform: body?.platform ?? body?.solvedOnPlatform ?? "manual",
      sourceUrl: input.sourceUrl ?? "",
      platformSlug: input.platformSlug ?? "",
      solvedWithoutHelp: solveFlags.solvedWithoutHelp,
      neededHint: solveFlags.neededHint,
      neededSolution: solveFlags.neededSolution,
      confidenceAfter: confidence,
      feltDifficultyAfter: feltDifficulty,
      timeTakenMinutes: input.timeTakenMinutes,
      notes: input.notes ?? "",
      mistakeNotes: input.mistakeNotes ?? "",
      source: "extension",
    });

    return jsonResponse(
      {
        success: true,
        message: "Question created from extension",
        data: question,
      },
      201,
      origin,
    );
  } catch (error) {
    console.error("POST /api/extension/upsert-question failed", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to sync question from extension.",
      },
      500,
      origin,
    );
  }
}
