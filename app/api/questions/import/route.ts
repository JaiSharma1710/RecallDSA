import { connectToDatabase } from "@/lib/db";
import {
  buildImportedQuestion,
  getQuestionDuplicateKey,
  parseImportPayload,
  validateImportQuestion,
} from "@/lib/question-transfer";
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

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const rawQuestions = parseImportPayload(body);

    if (!rawQuestions) {
      return jsonError("JSON must be an array or an object with a questions array.", 400);
    }

    if (rawQuestions.length === 0) {
      return jsonError("Import file does not contain any questions.", 400);
    }

    const validatedQuestions = [];
    const importKeys = new Set<string>();
    let skippedInFileCount = 0;

    for (let index = 0; index < rawQuestions.length; index += 1) {
      const result = validateImportQuestion(rawQuestions[index]);

      if (!result.ok) {
        return jsonError(`Question ${index + 1}: ${result.error}`, 400);
      }

      const duplicateKey = getQuestionDuplicateKey(result.data.name, result.data.topic);

      if (importKeys.has(duplicateKey)) {
        skippedInFileCount += 1;
        continue;
      }

      importKeys.add(duplicateKey);
      validatedQuestions.push(result.data);
    }

    await connectToDatabase();

    const existingQuestions = await QuestionModel.find({}, { name: 1, topic: 1 }).lean();
    const existingKeys = new Set(
      existingQuestions.map((question) => getQuestionDuplicateKey(question.name, question.topic)),
    );
    const questionsToInsert = validatedQuestions
      .filter((question) => !existingKeys.has(getQuestionDuplicateKey(question.name, question.topic)))
      .map(buildImportedQuestion);
    const skippedExistingCount = validatedQuestions.length - questionsToInsert.length;
    const skippedCount = skippedInFileCount + skippedExistingCount;

    if (questionsToInsert.length === 0) {
      return Response.json({
        insertedCount: 0,
        skippedCount,
        message: "No new questions were imported.",
      });
    }

    const insertedQuestions = await QuestionModel.insertMany(questionsToInsert);

    return Response.json(
      {
        insertedCount: insertedQuestions.length,
        skippedCount,
        questions: insertedQuestions,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/questions/import failed", error);
    return jsonError("Failed to import questions.", 500);
  }
}
