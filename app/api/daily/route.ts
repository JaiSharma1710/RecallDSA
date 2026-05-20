import { connectToDatabase } from "@/lib/db";
import { getSelectionReason, type QuestionStatus } from "@/lib/scoring";
import QuestionModel, { type Question } from "@/models/Question";

export const dynamic = "force-dynamic";

type DailyQuestion = Question & {
  selectionReasons: string[];
};

const DAILY_LIMIT = 5;
const MAX_PER_TOPIC = 2;
const statusPriority: Record<QuestionStatus, number> = {
  Red: 0,
  Orange: 1,
  Yellow: 2,
  Green: 3,
};

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

function sortByPriority(questions: Question[]) {
  return [...questions].sort((a, b) => {
    const statusDifference = statusPriority[a.status] - statusPriority[b.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return b.weaknessScore - a.weaknessScore;
  });
}

function pickWithTopicLimit(questions: Question[], limit: number) {
  const selected: Question[] = [];
  const topicCounts = new Map<string, number>();

  for (const question of questions) {
    if (selected.length >= limit) {
      break;
    }

    const currentTopicCount = topicCounts.get(question.topic) ?? 0;

    if (currentTopicCount >= MAX_PER_TOPIC) {
      continue;
    }

    selected.push(question);
    topicCounts.set(question.topic, currentTopicCount + 1);
  }

  return selected;
}

function fillRemaining(selected: Question[], candidates: Question[], limit: number) {
  const selectedIds = new Set(selected.map((question) => question._id.toString()));
  const output = [...selected];

  for (const question of candidates) {
    if (output.length >= limit) {
      break;
    }

    if (selectedIds.has(question._id.toString())) {
      continue;
    }

    output.push(question);
    selectedIds.add(question._id.toString());
  }

  return output;
}

function selectDailyQuestions(questions: Question[]) {
  const sortedQuestions = sortByPriority(questions);
  const nonGreenQuestions = sortedQuestions.filter((question) => question.status !== "Green");
  const candidatePool =
    nonGreenQuestions.length >= DAILY_LIMIT ? nonGreenQuestions : sortedQuestions;

  const topicLimitedSelection = pickWithTopicLimit(candidatePool, DAILY_LIMIT);

  return fillRemaining(topicLimitedSelection, sortedQuestions, Math.min(DAILY_LIMIT, questions.length));
}

export async function GET() {
  try {
    await connectToDatabase();

    const activeQuestions = await QuestionModel.find({ isArchived: false }).lean<Question[]>();
    const selectedQuestions = selectDailyQuestions(activeQuestions);
    const questionsWithReasons: DailyQuestion[] = selectedQuestions.map((question) => ({
      ...question,
      selectionReasons: getSelectionReason(question),
    }));

    return Response.json({
      date: getTodayDate(),
      questions: questionsWithReasons,
    });
  } catch (error) {
    console.error("GET /api/daily failed", error);
    return jsonError("Failed to fetch daily questions.", 500);
  }
}
