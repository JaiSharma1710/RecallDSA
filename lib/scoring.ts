export type QuestionStatus = "Red" | "Orange" | "Yellow" | "Green";

export type ScorableQuestion = {
  feltDifficulty: number;
  neededHint: boolean;
  neededSolution: boolean;
  confidence: number;
  revisionCount: number;
  solvedWithoutHelpCount: number;
  lastRevisedAt?: Date | string | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getDaysSince(date: Date | string, now: Date) {
  const revisedAt = new Date(date);

  if (Number.isNaN(revisedAt.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((now.getTime() - revisedAt.getTime()) / MS_PER_DAY));
}

export function calculateWeaknessScore(question: ScorableQuestion, now = new Date()) {
  const baseScore =
    question.feltDifficulty * 3 +
    (question.neededHint ? 4 : 0) +
    (question.neededSolution ? 7 : 0) +
    (5 - question.confidence) * 4;

  const recencyScore = question.lastRevisedAt
    ? Math.min(getDaysSince(question.lastRevisedAt, now) * 0.6, 15)
    : 10;

  const reductionScore =
    question.revisionCount * 1.5 + question.solvedWithoutHelpCount * 2;

  return Math.max(0, baseScore + recencyScore - reductionScore);
}

export function getStatusFromScore(score: number): QuestionStatus {
  if (score >= 25) {
    return "Red";
  }

  if (score >= 16) {
    return "Orange";
  }

  if (score >= 8) {
    return "Yellow";
  }

  return "Green";
}

export function calculateQuestionStatus(question: ScorableQuestion, now = new Date()) {
  return getStatusFromScore(calculateWeaknessScore(question, now));
}

export function calculateScoreAndStatus(question: ScorableQuestion, now = new Date()) {
  const weaknessScore = calculateWeaknessScore(question, now);

  return {
    weaknessScore,
    status: getStatusFromScore(weaknessScore),
  };
}

export function getSelectionReason(question: ScorableQuestion, now = new Date()) {
  const reasons: string[] = [];
  const daysSinceLastRevised = question.lastRevisedAt
    ? getDaysSince(question.lastRevisedAt, now)
    : null;

  if (question.confidence <= 2) {
    reasons.push("Low confidence");
  }

  if (question.neededSolution) {
    reasons.push("Needed solution");
  } else if (question.neededHint) {
    reasons.push("Needed hint");
  }

  if (daysSinceLastRevised === null || daysSinceLastRevised >= 14) {
    reasons.push("Not revised recently");
  }

  if (question.feltDifficulty >= 4) {
    reasons.push("High felt difficulty");
  }

  if (question.revisionCount === 0) {
    reasons.push("First revision pending");
  }

  return reasons;
}
