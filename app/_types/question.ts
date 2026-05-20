export type QuestionStatus = "Red" | "Orange" | "Yellow" | "Green";
export type QuestionDifficulty = "Easy" | "Medium" | "Hard";

export type Question = {
  _id: string;
  name: string;
  topic: string;
  difficulty: QuestionDifficulty;
  link?: string;
  feltDifficulty: number;
  confidence: number;
  neededHint: boolean;
  neededSolution: boolean;
  revisionCount: number;
  solvedWithoutHelpCount: number;
  lastRevisedAt?: string | null;
  nextReviewAt?: string | null;
  status: QuestionStatus;
  weaknessScore: number;
  notes?: string;
  mistakeNotes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  selectionReasons?: string[];
};

export type RevisionLog = {
  _id: string;
  questionId: string;
  revisedAt: string;
  solvedWithoutHelp: boolean;
  neededHint: boolean;
  neededSolution: boolean;
  confidenceAfter: number;
  feltDifficultyAfter: number;
  timeTakenMinutes?: number | null;
  mistakeNotes?: string;
  createdAt: string;
  updatedAt: string;
};
