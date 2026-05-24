import type { QueryFilter, SortOrder } from "mongoose";
import { NextRequest } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { normalizeQuestionLinks } from "@/lib/question-links";
import { normalizePlatforms } from "@/lib/platform";
import { validateQuestionInput } from "@/lib/question-input";
import { calculateScoreAndStatus } from "@/lib/scoring";
import QuestionModel, {
  QUESTION_DIFFICULTIES,
  QUESTION_STATUSES,
  type Question,
} from "@/models/Question";

export const dynamic = "force-dynamic";

const sortOptions: Record<string, Record<string, SortOrder>> = {
  weaknessScore: { weaknessScore: -1, createdAt: -1 },
  lastRevisedAt: { lastRevisedAt: 1, createdAt: -1 },
  createdAt: { createdAt: -1 },
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const filter: QueryFilter<Question> = { isArchived: false };
    const topic = searchParams.get("topic")?.trim();
    const difficulty = searchParams.get("difficulty")?.trim();
    const status = searchParams.get("status")?.trim();
    const platform = searchParams.get("platform")?.trim();
    const search = searchParams.get("search")?.trim();
    const sortBy = searchParams.get("sortBy") ?? "weaknessScore";

    if (topic) {
      filter.topic = topic;
    }

    if (difficulty) {
      if (!QUESTION_DIFFICULTIES.includes(difficulty as never)) {
        return jsonError("difficulty must be Easy, Medium, or Hard.", 400);
      }

      filter.difficulty = difficulty as (typeof QUESTION_DIFFICULTIES)[number];
    }

    if (status) {
      if (!QUESTION_STATUSES.includes(status as never)) {
        return jsonError("status must be Red, Orange, Yellow, or Green.", 400);
      }

      filter.status = status as (typeof QUESTION_STATUSES)[number];
    }

    if (platform) {
      filter.platforms = normalizePlatforms([platform])[0];
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.name = regex;
    }

    if (!sortOptions[sortBy]) {
      return jsonError(
        "sortBy must be weaknessScore, lastRevisedAt, or createdAt.",
        400,
      );
    }

    const questions = await QuestionModel.find(filter)
      .sort(sortOptions[sortBy])
      .lean();

    return Response.json({ questions });
  } catch (error) {
    console.error("GET /api/questions failed", error);
    return jsonError("Failed to fetch questions.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const result = validateQuestionInput(body, { partial: false });

    if (!result.ok) {
      return jsonError(result.error, 400);
    }

    const questionData = {
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
      neededHint: false,
      neededSolution: false,
      revisionCount: 0,
      solvedWithoutHelpCount: 0,
      solvedAt: new Date(),
      ...result.data,
    };
    const scoreAndStatus = calculateScoreAndStatus(questionData);

    await connectToDatabase();

    const question = await QuestionModel.create({
      ...questionData,
      ...scoreAndStatus,
    });

    return Response.json({ question }, { status: 201 });
  } catch (error) {
    console.error("POST /api/questions failed", error);
    return jsonError("Failed to create question.", 500);
  }
}
