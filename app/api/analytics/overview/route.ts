import { NextRequest } from "next/server";

import { calculateOverviewAnalytics } from "@/lib/analytics";
import { connectToDatabase } from "@/lib/db";
import QuestionModel from "@/models/Question";
import RevisionLogModel from "@/models/RevisionLog";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const range = Number(request.nextUrl.searchParams.get("range") ?? "30");

    if (![7, 30, 90, 365].includes(range)) {
      return jsonError("range must be 7, 30, 90, or 365.", 400);
    }

    await connectToDatabase();

    const [questions, revisions] = await Promise.all([
      QuestionModel.find({ isArchived: false }).lean(),
      RevisionLogModel.find({}).sort({ revisedAt: 1 }).lean(),
    ]);
    const activeQuestionIds = new Set(questions.map((question) => question._id.toString()));
    const activeRevisions = revisions.filter((revision) =>
      activeQuestionIds.has(revision.questionId.toString()),
    );

    return Response.json(calculateOverviewAnalytics(questions, activeRevisions, range));
  } catch (error) {
    console.error("GET /api/analytics/overview failed", error);
    return jsonError("Failed to fetch analytics overview.", 500);
  }
}
