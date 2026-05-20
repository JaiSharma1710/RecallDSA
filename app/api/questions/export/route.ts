import { connectToDatabase } from "@/lib/db";
import { buildExportQuestion } from "@/lib/question-transfer";
import QuestionModel from "@/models/Question";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function GET() {
  try {
    await connectToDatabase();

    const questions = await QuestionModel.find({ isArchived: false })
      .sort({ createdAt: -1 })
      .lean();
    const exportQuestions = questions.map(buildExportQuestion);
    const filename = `dsa-questions-${getTodayDate()}.json`;

    return new Response(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          count: exportQuestions.length,
          questions: exportQuestions,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      },
    );
  } catch (error) {
    console.error("GET /api/questions/export failed", error);
    return jsonError("Failed to export questions.", 500);
  }
}
