import { getSelectionReason, type QuestionStatus } from "@/lib/scoring";
import type { Question } from "@/models/Question";

const DAILY_BATCH_SIZE = 5;
const MAX_PER_TOPIC = 2;

const statusPriority: Record<QuestionStatus, number> = {
  Red: 0,
  Orange: 1,
  Yellow: 2,
  Green: 3,
};

export function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isRevisedOnDate(lastRevisedAt: Date | string | null | undefined, dateKey: string) {
  if (!lastRevisedAt) {
    return false;
  }

  const revisedAt = new Date(lastRevisedAt);

  if (Number.isNaN(revisedAt.getTime())) {
    return false;
  }

  const year = revisedAt.getFullYear();
  const month = String(revisedAt.getMonth() + 1).padStart(2, "0");
  const day = String(revisedAt.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}` === dateKey;
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

export function selectDailyRevisionQuestions(
  questions: Question[],
  options?: { excludeQuestionIds?: string[]; limit?: number },
) {
  const excludeIds = new Set(options?.excludeQuestionIds ?? []);
  const limit = options?.limit ?? DAILY_BATCH_SIZE;
  const eligibleQuestions = questions.filter(
    (question) => !excludeIds.has(question._id.toString()) && !question.isArchived,
  );
  const sortedQuestions = sortByPriority(eligibleQuestions);
  const nonGreenQuestions = sortedQuestions.filter((question) => question.status !== "Green");
  const candidatePool =
    nonGreenQuestions.length >= limit ? nonGreenQuestions : sortedQuestions;

  const topicLimitedSelection = pickWithTopicLimit(candidatePool, limit);
  const selected = fillRemaining(
    topicLimitedSelection,
    sortedQuestions,
    Math.min(limit, eligibleQuestions.length),
  );

  return selected.map((question) => ({
    question,
    selectionReasons: getSelectionReason(question),
  }));
}

export function getDailyBatchSize() {
  return DAILY_BATCH_SIZE;
}
