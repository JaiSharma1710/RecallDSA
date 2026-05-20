import { normalizePlatforms } from "@/lib/platform";
import type { QuestionPlatform, QuestionStatus } from "@/app/_types/question";

export const ANALYTICS_TIME_ZONE = "Asia/Kolkata";
export const ANALYTICS_RANGES = [7, 30, 90, 365] as const;

type RevisionLike = {
  revisedAt: Date | string;
  platform?: string | null;
  solvedWithoutHelp: boolean;
  neededHint: boolean;
  neededSolution: boolean;
  confidenceAfter: number;
  feltDifficultyAfter: number;
  timeTakenMinutes?: number | null;
  source?: string | null;
  sourceUrl?: string | null;
  platformSlug?: string | null;
  questionId?: string | { toString(): string };
};

type QuestionLike = {
  _id: string | { toString(): string };
  name: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  status: QuestionStatus;
  weaknessScore: number;
  confidence: number;
  revisionCount: number;
  feltDifficulty: number;
  solvedWithoutHelpCount: number;
  lastRevisedAt?: Date | string | null;
  platform?: string | null;
  platforms?: Array<string | null | undefined> | null;
};

export type DateRange = (typeof ANALYTICS_RANGES)[number];

type DayGroup = {
  date: string;
  count: number;
  solvedWithoutHelp: number;
  neededHint: number;
  neededSolution: number;
};

function getDateParts(date: Date, timeZone = ANALYTICS_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return { year, month, day };
}

export function getDateKey(date: Date | string, timeZone = ANALYTICS_TIME_ZONE) {
  const value = typeof date === "string" ? new Date(date) : date;
  const { year, month, day } = getDateParts(value, timeZone);
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDateKeys(startDateKey: string, endDateKey: string) {
  const keys: string[] = [];
  let current = startDateKey;

  while (current <= endDateKey) {
    keys.push(current);
    current = addDays(current, 1);
  }

  return keys;
}

export function getDateRange(range: number, now = new Date(), timeZone = ANALYTICS_TIME_ZONE) {
  const safeRange = ANALYTICS_RANGES.includes(range as DateRange) ? range : 30;
  const endDateKey = getDateKey(now, timeZone);
  const startDateKey = addDays(endDateKey, -(safeRange - 1));

  return {
    range: safeRange,
    startDateKey,
    endDateKey,
    dateKeys: buildDateKeys(startDateKey, endDateKey),
  };
}

export function groupRevisionsByDay(
  revisions: RevisionLike[],
  dateKeys?: string[],
  timeZone = ANALYTICS_TIME_ZONE,
) {
  const grouped = new Map<string, DayGroup>();

  for (const revision of revisions) {
    const dateKey = getDateKey(revision.revisedAt, timeZone);
    const current = grouped.get(dateKey) ?? {
      date: dateKey,
      count: 0,
      solvedWithoutHelp: 0,
      neededHint: 0,
      neededSolution: 0,
    };

    current.count += 1;
    current.solvedWithoutHelp += revision.solvedWithoutHelp ? 1 : 0;
    current.neededHint += revision.neededHint ? 1 : 0;
    current.neededSolution += revision.neededSolution ? 1 : 0;
    grouped.set(dateKey, current);
  }

  const keys = dateKeys ?? [...grouped.keys()].sort();

  return keys.map((dateKey) => {
    return (
      grouped.get(dateKey) ?? {
        date: dateKey,
        count: 0,
        solvedWithoutHelp: 0,
        neededHint: 0,
        neededSolution: 0,
      }
    );
  });
}

export function calculateStreaks(
  revisions: RevisionLike[],
  now = new Date(),
  timeZone = ANALYTICS_TIME_ZONE,
) {
  const revisionDays = new Set(revisions.map((revision) => getDateKey(revision.revisedAt, timeZone)));
  const today = getDateKey(now, timeZone);
  let currentStreak = 0;
  let cursor = today;

  while (revisionDays.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  const sortedDays = [...revisionDays].sort();
  let bestStreak = 0;
  let streak = 0;
  let previousDay: string | null = null;

  for (const day of sortedDays) {
    if (previousDay && addDays(previousDay, 1) === day) {
      streak += 1;
    } else {
      streak = 1;
    }

    previousDay = day;
    bestStreak = Math.max(bestStreak, streak);
  }

  return {
    currentStreak,
    bestStreak,
    revisedToday: revisionDays.has(today),
  };
}

export function buildHeatmapData(
  revisions: RevisionLike[],
  now = new Date(),
  timeZone = ANALYTICS_TIME_ZONE,
) {
  const { dateKeys } = getDateRange(365, now, timeZone);
  const grouped = groupRevisionsByDay(revisions, dateKeys, timeZone);

  return grouped.map((item) => ({
    date: item.date,
    count: item.count,
    level: item.count >= 3 ? 3 : item.count >= 2 ? 2 : item.count >= 1 ? 1 : 0,
  }));
}

export function calculateTopicWeakness(questions: QuestionLike[]) {
  const grouped = new Map<
    string,
    { topic: string; totalQuestions: number; totalWeaknessScore: number; redOrangeCount: number }
  >();

  for (const question of questions) {
    const current = grouped.get(question.topic) ?? {
      topic: question.topic,
      totalQuestions: 0,
      totalWeaknessScore: 0,
      redOrangeCount: 0,
    };

    current.totalQuestions += 1;
    current.totalWeaknessScore += question.weaknessScore;
    current.redOrangeCount += question.status === "Red" || question.status === "Orange" ? 1 : 0;
    grouped.set(question.topic, current);
  }

  return [...grouped.values()]
    .map((item) => ({
      topic: item.topic,
      count: item.totalQuestions,
      averageWeaknessScore:
        item.totalQuestions === 0 ? 0 : item.totalWeaknessScore / item.totalQuestions,
      redOrangeCount: item.redOrangeCount,
    }))
    .sort((a, b) => b.averageWeaknessScore - a.averageWeaknessScore);
}

export function calculatePlatformDistribution(
  questions: QuestionLike[],
  revisions: RevisionLike[],
) {
  const questionCounts = new Map<QuestionPlatform, number>();
  const revisionCounts = new Map<QuestionPlatform, number>();

  for (const question of questions) {
    for (const platform of normalizePlatforms(question.platforms, question.platform)) {
      questionCounts.set(platform, (questionCounts.get(platform) ?? 0) + 1);
    }
  }

  for (const revision of revisions) {
    const platform = normalizePlatforms([revision.platform], revision.platform)[0];
    revisionCounts.set(platform, (revisionCounts.get(platform) ?? 0) + 1);
  }

  return buildPlatformRows(questionCounts, revisionCounts);
}

function buildPlatformRows(
  questionCounts: Map<QuestionPlatform, number>,
  revisionCounts: Map<QuestionPlatform, number>,
) {
  return (["leetcode", "gfg", "neetcode", "tuf", "manual"] as QuestionPlatform[]).map(
    (platform) => ({
      platform,
      questionCount: questionCounts.get(platform) ?? 0,
      revisionCount: revisionCounts.get(platform) ?? 0,
      total: (questionCounts.get(platform) ?? 0) + (revisionCounts.get(platform) ?? 0),
    }),
  );
}

export function calculateHelpDependency(groupedDays: DayGroup[]) {
  return groupedDays.map((day) => ({
    date: day.date,
    solvedWithoutHelp: day.solvedWithoutHelp,
    neededHint: day.neededHint,
    neededSolution: day.neededSolution,
  }));
}

export function calculateQuestionProgress(revisions: RevisionLike[], question?: QuestionLike) {
  const sortedRevisions = [...revisions].sort(
    (a, b) => new Date(a.revisedAt).getTime() - new Date(b.revisedAt).getTime(),
  );
  const confidenceOverTime = sortedRevisions.map((revision) => ({
    date: getDateKey(revision.revisedAt),
    confidence: revision.confidenceAfter,
  }));
  const difficultyOverTime = sortedRevisions.map((revision) => ({
    date: getDateKey(revision.revisedAt),
    feltDifficulty: revision.feltDifficultyAfter,
  }));
  const timeOverTime = sortedRevisions
    .filter((revision) => revision.timeTakenMinutes !== null && revision.timeTakenMinutes !== undefined)
    .map((revision) => ({
      date: getDateKey(revision.revisedAt),
      timeTakenMinutes: revision.timeTakenMinutes ?? 0,
    }));

  const helpCounts = {
    solvedWithoutHelp: sortedRevisions.filter((revision) => revision.solvedWithoutHelp).length,
    neededHint: sortedRevisions.filter((revision) => revision.neededHint).length,
    neededSolution: sortedRevisions.filter((revision) => revision.neededSolution).length,
  };
  const timeValues = timeOverTime.map((item) => item.timeTakenMinutes);
  const platforms = question
    ? normalizePlatforms(question.platforms, question.platform)
    : normalizePlatforms(
        sortedRevisions.map((revision) => revision.platform),
        sortedRevisions.at(-1)?.platform,
      );

  return {
    confidenceOverTime,
    difficultyOverTime,
    timeOverTime,
    helpCounts,
    revisionCount: sortedRevisions.length,
    averageTime:
      timeValues.length === 0
        ? null
        : timeValues.reduce((sum, value) => sum + value, 0) / timeValues.length,
    bestConfidence:
      sortedRevisions.length === 0
        ? question?.confidence ?? null
        : Math.max(...sortedRevisions.map((revision) => revision.confidenceAfter)),
    latestConfidence:
      sortedRevisions.at(-1)?.confidenceAfter ?? question?.confidence ?? null,
    latestDifficulty:
      sortedRevisions.at(-1)?.feltDifficultyAfter ?? question?.feltDifficulty ?? null,
    solvedWithoutHelpCount: helpCounts.solvedWithoutHelp,
    lastRevisedDate: sortedRevisions.at(-1)?.revisedAt ?? question?.lastRevisedAt ?? null,
    platforms,
  };
}

export function calculateStrongestImprovement(
  questions: QuestionLike[],
  revisions: RevisionLike[],
) {
  const questionMap = new Map(questions.map((question) => [question._id.toString(), question]));
  const grouped = new Map<string, RevisionLike[]>();

  for (const revision of revisions) {
    const questionId = revision.questionId?.toString();

    if (!questionId) {
      continue;
    }

    const list = grouped.get(questionId) ?? [];
    list.push(revision);
    grouped.set(questionId, list);
  }

  return [...grouped.entries()]
    .map(([questionId, questionRevisions]) => {
      const question = questionMap.get(questionId);

      if (!question || questionRevisions.length < 2) {
        return null;
      }

      const sortedRevisions = [...questionRevisions].sort(
        (a, b) => new Date(a.revisedAt).getTime() - new Date(b.revisedAt).getTime(),
      );
      const first = sortedRevisions[0];
      const last = sortedRevisions[sortedRevisions.length - 1];
      const confidenceDelta = last.confidenceAfter - first.confidenceAfter;
      const difficultyDelta = first.feltDifficultyAfter - last.feltDifficultyAfter;
      const firstTime = first.timeTakenMinutes ?? null;
      const lastTime = last.timeTakenMinutes ?? null;
      const timeDelta =
        firstTime !== null && lastTime !== null ? Math.max(0, firstTime - lastTime) : 0;
      const score = confidenceDelta * 3 + difficultyDelta * 2 + timeDelta / 10;

      if (score <= 0) {
        return null;
      }

      return {
        questionId,
        name: question.name,
        topic: question.topic,
        difficulty: question.difficulty,
        status: question.status,
        weaknessScore: question.weaknessScore,
        platforms: normalizePlatforms(question.platforms, question.platform),
        confidenceDelta,
        difficultyDelta,
        timeDelta,
        score,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export function calculateStatusDistribution(questions: QuestionLike[]) {
  return (["Red", "Orange", "Yellow", "Green"] as QuestionStatus[]).map((status) => ({
    status,
    count: questions.filter((question) => question.status === status).length,
  }));
}

export function calculateOverviewAnalytics(
  questions: QuestionLike[],
  revisions: RevisionLike[],
  range: number,
  now = new Date(),
  timeZone = ANALYTICS_TIME_ZONE,
) {
  const normalizedRange = getDateRange(range, now, timeZone);
  const heatmap = buildHeatmapData(revisions, now, timeZone);
  const dailyRevisions = groupRevisionsByDay(revisions, normalizedRange.dateKeys, timeZone);
  const totalRevisionsInRange = dailyRevisions.reduce((sum, day) => sum + day.count, 0);
  const { currentStreak, bestStreak } = calculateStreaks(revisions, now, timeZone);
  const topicWeakness = calculateTopicWeakness(questions);
  const statusDistribution = calculateStatusDistribution(questions);
  const platformDistribution = calculatePlatformDistribution(questions, revisions);
  const helpDependency = calculateHelpDependency(dailyRevisions);
  const weakestQuestions = [...questions]
    .sort((a, b) => b.weaknessScore - a.weaknessScore)
    .slice(0, 10)
    .map((question) => ({
      questionId: question._id.toString(),
      name: question.name,
      topic: question.topic,
      difficulty: question.difficulty,
      weaknessScore: question.weaknessScore,
      status: question.status,
      platforms: normalizePlatforms(question.platforms, question.platform),
    }));
  const strongestImprovement = calculateStrongestImprovement(questions, revisions);
  const todayDateKey = getDateKey(now, timeZone);
  const revisedToday = dailyRevisions.find((day) => day.date === todayDateKey)?.count ?? 0;

  return {
    range: normalizedRange.range,
    summary: {
      totalQuestions: questions.length,
      totalRevisions: revisions.length,
      revisedToday,
      currentStreak,
      bestStreak,
      notRevisedRecently: questions.filter((question) => {
        if (!question.lastRevisedAt) {
          return true;
        }

        const lastRevisedKey = getDateKey(question.lastRevisedAt, timeZone);
        return lastRevisedKey < addDays(todayDateKey, -14);
      }).length,
      averageConfidence:
        questions.length === 0
          ? 0
          : questions.reduce((sum, question) => sum + question.confidence, 0) / questions.length,
      averageWeaknessScore:
        questions.length === 0
          ? 0
          : questions.reduce((sum, question) => sum + question.weaknessScore, 0) / questions.length,
      statusCounts: statusDistribution,
      totalRevisionsInRange,
      dailyAverage: totalRevisionsInRange / normalizedRange.range,
      weeklyAverage: totalRevisionsInRange / Math.max(1, normalizedRange.range / 7),
      monthlyAverage: totalRevisionsInRange / Math.max(1, normalizedRange.range / 30),
    },
    heatmap,
    dailyRevisions,
    topicWeakness,
    statusDistribution,
    platformDistribution,
    helpDependency,
    weakestQuestions,
    strongestImprovement,
  };
}
