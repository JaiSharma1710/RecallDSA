import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { normalizeQuestionLinks, syncQuestionLinksForLinkField } from "@/lib/question-links";
import { normalizePlatforms } from "@/lib/platform";
import { validateQuestionInput } from "@/lib/question-input";
import { calculateScoreAndStatus } from "@/lib/scoring";
import QuestionModel from "@/models/Question";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getQuestionId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return id;
}

function isValidQuestionId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = await getQuestionId(context);

    if (!isValidQuestionId(id)) {
      return jsonError("Invalid question id.", 400);
    }

    await connectToDatabase();

    const question = await QuestionModel.findOne({
      _id: id,
      isArchived: false,
    }).lean();

    if (!question) {
      return jsonError("Question not found.", 404);
    }

    return Response.json({ question });
  } catch (error) {
    console.error("GET /api/questions/[id] failed", error);
    return jsonError("Failed to fetch question.", 500);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = await getQuestionId(context);

    if (!isValidQuestionId(id)) {
      return jsonError("Invalid question id.", 400);
    }

    const body = await readJson(request);
    const result = validateQuestionInput(body, { partial: true });

    if (!result.ok) {
      return jsonError(result.error, 400);
    }

    await connectToDatabase();

    const question = await QuestionModel.findOne({
      _id: id,
      isArchived: false,
    });

    if (!question) {
      return jsonError("Question not found.", 404);
    }

    const restData = { ...result.data };
    delete restData.platform;
    delete restData.platforms;
    delete restData.questionLinks;
    const currentPlatforms = normalizePlatforms(question.platforms, question.platform);
    const nextPlatforms =
      result.data.platform !== undefined || result.data.platforms !== undefined
        ? normalizePlatforms(
            [
              ...currentPlatforms,
              ...(result.data.platforms ?? []),
              ...(result.data.platform ? [result.data.platform] : []),
            ],
            result.data.platform ?? question.platform,
          )
        : undefined;
    const nextQuestionLinks =
      result.data.questionLinks !== undefined || result.data.link !== undefined
        ? syncQuestionLinksForLinkField(
            normalizeQuestionLinks({
              questionLinks:
                result.data.questionLinks ??
                question.questionLinks ??
                [],
              platforms: nextPlatforms ?? currentPlatforms,
              fallbackPlatform: result.data.platform ?? question.platform,
              link: question.link,
              sourceUrl: question.sourceUrl,
              platformSlug: question.platformSlug,
            }),
            result.data.link,
            "manual",
          )
        : undefined;

    question.set({
      ...restData,
      ...(nextPlatforms ? { platforms: nextPlatforms } : {}),
      ...(nextQuestionLinks ? { questionLinks: nextQuestionLinks } : {}),
    });

    const scoreAndStatus = calculateScoreAndStatus({
      feltDifficulty: question.feltDifficulty,
      neededHint: question.neededHint,
      neededSolution: question.neededSolution,
      confidence: question.confidence,
      revisionCount: question.revisionCount,
      solvedWithoutHelpCount: question.solvedWithoutHelpCount,
      lastRevisedAt: question.lastRevisedAt,
    });

    question.set(scoreAndStatus);
    await question.save();

    return Response.json({ question });
  } catch (error) {
    console.error("PATCH /api/questions/[id] failed", error);
    return jsonError("Failed to update question.", 500);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = await getQuestionId(context);

    if (!isValidQuestionId(id)) {
      return jsonError("Invalid question id.", 400);
    }

    await connectToDatabase();

    const question = await QuestionModel.findOneAndUpdate(
      { _id: id, isArchived: false },
      { isArchived: true },
      { new: true },
    );

    if (!question) {
      return jsonError("Question not found.", 404);
    }

    return Response.json({ question });
  } catch (error) {
    console.error("DELETE /api/questions/[id] failed", error);
    return jsonError("Failed to delete question.", 500);
  }
}
