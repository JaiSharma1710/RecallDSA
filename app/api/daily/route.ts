import { connectToDatabase } from "@/lib/db";
import {
  getDailyBatchSize,
  getTodayDateKey,
  isRevisedOnDate,
  selectDailyRevisionQuestions,
} from "@/lib/daily-revision";
import QuestionModel, { type Question } from "@/models/Question";
import DailyRevisionSessionModel from "@/models/DailyRevisionSession";

export const dynamic = "force-dynamic";

type DailyQuestion = Question & {
  completedToday: boolean;
  selectionReasons: string[];
};

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code }, { status });
}

function isValidAction(value: unknown): value is "generate" | "extend" {
  return value === "generate" || value === "extend";
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function buildDailyResponse(dateKey: string) {
  const session = await DailyRevisionSessionModel.findOne({ sessionDate: dateKey }).lean();

  if (!session) {
    return {
      date: dateKey,
      needsGeneration: true,
      canExtend: false,
      generatedCount: 0,
      completedCount: 0,
      remainingCount: 0,
      questions: [] as DailyQuestion[],
    };
  }

  const questionIds = session.entries.map((entry) => entry.questionId.toString());
  const questions = await QuestionModel.find({
    _id: { $in: questionIds },
    isArchived: false,
  }).lean<Question[]>();
  const questionMap = new Map(questions.map((question) => [question._id.toString(), question]));

  const orderedQuestions = session.entries
    .map((entry) => {
      const question = questionMap.get(entry.questionId.toString());

      if (!question) {
        return null;
      }

      return {
        ...question,
        completedToday: isRevisedOnDate(question.lastRevisedAt, dateKey),
        selectionReasons: entry.selectionReasons ?? [],
      } satisfies DailyQuestion;
    })
    .filter((question): question is DailyQuestion => question !== null);

  const completedCount = orderedQuestions.filter((question) => question.completedToday).length;

  return {
    date: dateKey,
    needsGeneration: false,
    canExtend: orderedQuestions.length > 0 && completedCount === orderedQuestions.length,
    generatedCount: orderedQuestions.length,
    completedCount,
    remainingCount: Math.max(orderedQuestions.length - completedCount, 0),
    questions: orderedQuestions,
  };
}

export async function GET() {
  try {
    await connectToDatabase();

    return Response.json(await buildDailyResponse(getTodayDateKey()));
  } catch (error) {
    console.error("GET /api/daily failed", error);
    return jsonError("Failed to fetch daily revision session.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const action = body?.action;

    if (!isValidAction(action)) {
      return jsonError("action must be generate or extend.", 400, "INVALID_ACTION");
    }

    await connectToDatabase();

    const dateKey = getTodayDateKey();
    const existingSession = await DailyRevisionSessionModel.findOne({ sessionDate: dateKey });

    if (action === "generate") {
      if (existingSession) {
        return jsonError(
          "Today’s revision set is already generated. Open Daily 5 to continue.",
          409,
          "ALREADY_GENERATED",
        );
      }

      const activeQuestions = await QuestionModel.find({ isArchived: false }).lean<Question[]>();
      const selected = selectDailyRevisionQuestions(activeQuestions, {
        limit: getDailyBatchSize(),
      });

      if (selected.length === 0) {
        return jsonError("No eligible questions available to generate today’s revision set.", 400);
      }

      await DailyRevisionSessionModel.create({
        sessionDate: dateKey,
        entries: selected.map(({ question, selectionReasons }, index) => ({
          questionId: question._id,
          batchNumber: 1,
          order: index,
          selectionReasons,
        })),
      });

      return Response.json(await buildDailyResponse(dateKey), { status: 201 });
    }

    if (!existingSession) {
      return jsonError(
        "Generate today’s revision set first before unlocking more questions.",
        400,
        "SESSION_MISSING",
      );
    }

    const questionIds = existingSession.entries.map((entry) => entry.questionId.toString());
    const currentQuestions = await QuestionModel.find({
      _id: { $in: questionIds },
      isArchived: false,
    }).lean<Question[]>();
    const allCurrentCompleted = currentQuestions.every((question) =>
      isRevisedOnDate(question.lastRevisedAt, dateKey),
    );

    if (!allCurrentCompleted) {
      return jsonError(
        "Finish the current revision set before unlocking 5 more.",
        400,
        "EXTEND_NOT_READY",
      );
    }

    const activeQuestions = await QuestionModel.find({ isArchived: false }).lean<Question[]>();
    const nextBatchNumber = Math.max(...existingSession.entries.map((entry) => entry.batchNumber), 0) + 1;
    const selected = selectDailyRevisionQuestions(activeQuestions, {
      excludeQuestionIds: questionIds,
      limit: getDailyBatchSize(),
    });

    if (selected.length === 0) {
      return jsonError(
        "No more eligible questions are available for today’s next batch.",
        400,
        "NO_MORE_QUESTIONS",
      );
    }

    const startingOrder = existingSession.entries.length;

    existingSession.entries.push(
      ...selected.map(({ question, selectionReasons }, index) => ({
        questionId: question._id,
        batchNumber: nextBatchNumber,
        order: startingOrder + index,
        selectionReasons,
      })),
    );
    await existingSession.save();

    return Response.json(await buildDailyResponse(dateKey), { status: 201 });
  } catch (error) {
    console.error("POST /api/daily failed", error);
    return jsonError("Failed to generate daily revision session.", 500);
  }
}
