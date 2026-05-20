import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { normalizeQuestionLinks } from "@/lib/question-links";
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

    const question = await QuestionModel.findOne({
      _id: id,
      isArchived: false,
    }).lean();

    if (!question) {
      return jsonError("Question not found.", 404);
    }

    const revisions = await RevisionLogModel.find(
      { questionId: id, sourceUrl: { $ne: "" } },
      { platform: 1, sourceUrl: 1, platformSlug: 1, revisedAt: 1 },
    )
      .sort({ revisedAt: -1, createdAt: -1 })
      .lean();

    const revisionLinks = revisions.map((revision) => ({
      platform: revision.platform,
      url: revision.sourceUrl,
      platformSlug: revision.platformSlug,
    }));

    const links = normalizeQuestionLinks({
      questionLinks: [...(question.questionLinks ?? []), ...revisionLinks],
      platforms: question.platforms,
      fallbackPlatform: question.platform,
      link: question.link,
      sourceUrl: question.sourceUrl,
      platformSlug: question.platformSlug,
    });

    return Response.json({ links });
  } catch (error) {
    console.error("GET /api/questions/[id]/links failed", error);
    return jsonError("Failed to fetch question links.", 500);
  }
}
