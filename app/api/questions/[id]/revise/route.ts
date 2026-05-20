import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { normalizeQuestionLinks, upsertQuestionLink } from "@/lib/question-links";
import { normalizePlatforms } from "@/lib/platform";
import { validateRevisionInput } from "@/lib/revision-input";
import { calculateScoreAndStatus } from "@/lib/scoring";
import QuestionModel from "@/models/Question";
import RevisionLogModel from "@/models/RevisionLog";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = await getQuestionId(context);

    if (!isValidQuestionId(id)) {
      return jsonError("Invalid question id.", 400);
    }

    const body = await readJson(request);
    const result = validateRevisionInput(body);

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

    const revisedAt = new Date();
    const platform = result.data.platform ?? question.platform ?? "manual";
    const platforms = normalizePlatforms(question.platforms, question.platform);

    if (!platforms.includes(platform)) {
      platforms.push(platform);
    }

    const sourceUrl = result.data.sourceUrl ?? question.sourceUrl ?? question.link ?? "";
    const platformSlug = result.data.platformSlug ?? question.platformSlug ?? "";
    const questionLinks = result.data.sourceUrl
      ? upsertQuestionLink(question.questionLinks, {
          platform,
          url: result.data.sourceUrl,
          platformSlug: result.data.platformSlug,
        })
      : normalizeQuestionLinks({
          questionLinks: question.questionLinks,
          platforms,
          fallbackPlatform: question.platform,
          link: question.link,
          sourceUrl: question.sourceUrl,
          platformSlug: question.platformSlug,
        });
    const source = result.data.source ?? "manual";
    const revisionLog = await RevisionLogModel.create({
      questionId: question._id,
      revisedAt,
      platform,
      sourceUrl,
      platformSlug,
      solvedWithoutHelp: result.data.solvedWithoutHelp,
      neededHint: result.data.neededHint,
      neededSolution: result.data.neededSolution,
      confidenceAfter: result.data.confidenceAfter,
      feltDifficultyAfter: result.data.feltDifficultyAfter,
      timeTakenMinutes: result.data.timeTakenMinutes,
      notes: result.data.notes,
      mistakeNotes: result.data.mistakeNotes,
      source,
    });

    const revisionCount = question.revisionCount + 1;
    const solvedWithoutHelpCount =
      question.solvedWithoutHelpCount + (result.data.solvedWithoutHelp ? 1 : 0);

    const scoreAndStatus = calculateScoreAndStatus(
      {
        feltDifficulty: result.data.feltDifficultyAfter,
        neededHint: result.data.neededHint,
        neededSolution: result.data.neededSolution,
        confidence: result.data.confidenceAfter,
        revisionCount,
        solvedWithoutHelpCount,
        lastRevisedAt: revisedAt,
      },
      revisedAt,
    );

    question.set({
      revisionCount,
      solvedWithoutHelpCount,
      neededHint: result.data.neededHint,
      neededSolution: result.data.neededSolution,
      confidence: result.data.confidenceAfter,
      feltDifficulty: result.data.feltDifficultyAfter,
      lastRevisedAt: revisedAt,
      platforms,
      questionLinks,
      ...(result.data.sourceUrl !== undefined && !question.sourceUrl
        ? { sourceUrl: result.data.sourceUrl }
        : {}),
      ...(result.data.sourceUrl !== undefined && !question.link ? { link: result.data.sourceUrl } : {}),
      ...(result.data.platformSlug !== undefined
        && !question.platformSlug
        ? { platformSlug: result.data.platformSlug }
        : {}),
      ...(result.data.notes !== undefined
        ? { notes: mergeText(question.notes, result.data.notes) }
        : {}),
      ...(result.data.mistakeNotes !== undefined
        ? { mistakeNotes: mergeText(question.mistakeNotes, result.data.mistakeNotes) }
        : {}),
      ...scoreAndStatus,
    });

    await question.save();

    return Response.json({ question, revisionLog }, { status: 201 });
  } catch (error) {
    console.error("POST /api/questions/[id]/revise failed", error);
    return jsonError("Failed to revise question.", 500);
  }
}
