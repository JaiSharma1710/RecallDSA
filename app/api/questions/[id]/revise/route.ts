import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { validateRevisionInput } from "@/lib/revision-input";
import { calculateScoreAndStatus } from "@/lib/scoring";
import QuestionModel from "@/models/Question";
import RevisionLogModel from "@/models/RevisionLog";

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
    const revisionLog = await RevisionLogModel.create({
      questionId: question._id,
      revisedAt,
      solvedWithoutHelp: result.data.solvedWithoutHelp,
      neededHint: result.data.neededHint,
      neededSolution: result.data.neededSolution,
      confidenceAfter: result.data.confidenceAfter,
      feltDifficultyAfter: result.data.feltDifficultyAfter,
      timeTakenMinutes: result.data.timeTakenMinutes,
      mistakeNotes: result.data.mistakeNotes,
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
      ...(result.data.mistakeNotes !== undefined
        ? { mistakeNotes: result.data.mistakeNotes }
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
