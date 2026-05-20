import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import QuestionModel from "@/models/Question";
import RevisionLogModel from "@/models/RevisionLog";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
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

    const question = await QuestionModel.exists({
      _id: id,
      isArchived: false,
    });

    if (!question) {
      return jsonError("Question not found.", 404);
    }

    const revisions = await RevisionLogModel.find({ questionId: id })
      .sort({ revisedAt: -1, createdAt: -1 })
      .lean();

    return Response.json({ revisions });
  } catch (error) {
    console.error("GET /api/questions/[id]/revisions failed", error);
    return jsonError("Failed to fetch revisions.", 500);
  }
}
