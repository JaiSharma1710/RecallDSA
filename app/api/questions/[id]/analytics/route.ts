import mongoose from "mongoose";

import { calculateQuestionProgress } from "@/lib/analytics";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = await getQuestionId(context);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonError("Invalid question id.", 400);
    }

    await connectToDatabase();

    const [question, revisions] = await Promise.all([
      QuestionModel.findOne({ _id: id, isArchived: false }).lean(),
      RevisionLogModel.find({ questionId: id }).sort({ revisedAt: 1, createdAt: 1 }).lean(),
    ]);

    if (!question) {
      return jsonError("Question not found.", 404);
    }

    return Response.json(calculateQuestionProgress(revisions, question));
  } catch (error) {
    console.error("GET /api/questions/[id]/analytics failed", error);
    return jsonError("Failed to fetch question analytics.", 500);
  }
}
