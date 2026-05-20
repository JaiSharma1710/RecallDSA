import { connectToDatabase } from "@/lib/db";
import { calculateScoreAndStatus } from "@/lib/scoring";
import QuestionModel, { type Question } from "@/models/Question";

export const dynamic = "force-dynamic";

type SeedQuestion = Pick<
  Question,
  | "name"
  | "topic"
  | "difficulty"
  | "link"
  | "feltDifficulty"
  | "confidence"
  | "neededHint"
  | "neededSolution"
  | "revisionCount"
  | "solvedWithoutHelpCount"
  | "lastRevisedAt"
  | "notes"
  | "mistakeNotes"
>;

const SEED_NOTE_PREFIX = "[seed]";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function withScoreAndStatus(question: SeedQuestion) {
  return {
    ...question,
    ...calculateScoreAndStatus(question),
    isArchived: false,
  };
}

const seedQuestions: SeedQuestion[] = [
  {
    name: "Koko Eating Bananas",
    topic: "Binary Search",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/koko-eating-bananas/",
    feltDifficulty: 5,
    confidence: 2,
    neededHint: true,
    neededSolution: true,
    revisionCount: 1,
    solvedWithoutHelpCount: 0,
    lastRevisedAt: daysAgo(22),
    notes: `${SEED_NOTE_PREFIX} Binary search on answer.`,
    mistakeNotes: "Forgot why the speed range starts at 1.",
  },
  {
    name: "Book Allocation",
    topic: "Binary Search",
    difficulty: "Hard",
    link: "",
    feltDifficulty: 5,
    confidence: 1,
    neededHint: true,
    neededSolution: true,
    revisionCount: 0,
    solvedWithoutHelpCount: 0,
    lastRevisedAt: null,
    notes: `${SEED_NOTE_PREFIX} Classic minimum maximum pages problem.`,
    mistakeNotes: "Confused feasibility condition.",
  },
  {
    name: "Aggressive Cows",
    topic: "Binary Search",
    difficulty: "Medium",
    link: "",
    feltDifficulty: 4,
    confidence: 2,
    neededHint: true,
    neededSolution: false,
    revisionCount: 2,
    solvedWithoutHelpCount: 1,
    lastRevisedAt: daysAgo(14),
    notes: `${SEED_NOTE_PREFIX} Maximize minimum distance.`,
    mistakeNotes: "Off-by-one while placing cows.",
  },
  {
    name: "Search in Rotated Sorted Array",
    topic: "Binary Search",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/search-in-rotated-sorted-array/",
    feltDifficulty: 3,
    confidence: 3,
    neededHint: false,
    neededSolution: false,
    revisionCount: 3,
    solvedWithoutHelpCount: 2,
    lastRevisedAt: daysAgo(5),
    notes: `${SEED_NOTE_PREFIX} Identify sorted half before narrowing.`,
    mistakeNotes: "",
  },
  {
    name: "Maximum Subarray",
    topic: "Arrays",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/maximum-subarray/",
    feltDifficulty: 2,
    confidence: 5,
    neededHint: false,
    neededSolution: false,
    revisionCount: 5,
    solvedWithoutHelpCount: 5,
    lastRevisedAt: daysAgo(3),
    notes: `${SEED_NOTE_PREFIX} Kadane's algorithm.`,
    mistakeNotes: "",
  },
  {
    name: "Next Permutation",
    topic: "Arrays",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/next-permutation/",
    feltDifficulty: 4,
    confidence: 2,
    neededHint: true,
    neededSolution: false,
    revisionCount: 1,
    solvedWithoutHelpCount: 0,
    lastRevisedAt: daysAgo(30),
    notes: `${SEED_NOTE_PREFIX} Find pivot, swap with next greater, reverse suffix.`,
    mistakeNotes: "Picked wrong swap element from suffix.",
  },
  {
    name: "Merge Intervals",
    topic: "Arrays",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/merge-intervals/",
    feltDifficulty: 2,
    confidence: 4,
    neededHint: false,
    neededSolution: false,
    revisionCount: 4,
    solvedWithoutHelpCount: 3,
    lastRevisedAt: daysAgo(8),
    notes: `${SEED_NOTE_PREFIX} Sort by start and merge overlaps.`,
    mistakeNotes: "",
  },
  {
    name: "Reverse Linked List",
    topic: "Linked List",
    difficulty: "Easy",
    link: "https://leetcode.com/problems/reverse-linked-list/",
    feltDifficulty: 1,
    confidence: 5,
    neededHint: false,
    neededSolution: false,
    revisionCount: 6,
    solvedWithoutHelpCount: 6,
    lastRevisedAt: daysAgo(2),
    notes: `${SEED_NOTE_PREFIX} Iterative pointer reversal.`,
    mistakeNotes: "",
  },
  {
    name: "Detect Cycle in Linked List",
    topic: "Linked List",
    difficulty: "Easy",
    link: "https://leetcode.com/problems/linked-list-cycle/",
    feltDifficulty: 3,
    confidence: 3,
    neededHint: false,
    neededSolution: false,
    revisionCount: 2,
    solvedWithoutHelpCount: 1,
    lastRevisedAt: daysAgo(16),
    notes: `${SEED_NOTE_PREFIX} Floyd slow-fast pointers.`,
    mistakeNotes: "Forgot null checks in loop condition.",
  },
  {
    name: "Longest Substring Without Repeating Characters",
    topic: "Sliding Window",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    feltDifficulty: 4,
    confidence: 2,
    neededHint: true,
    neededSolution: false,
    revisionCount: 1,
    solvedWithoutHelpCount: 0,
    lastRevisedAt: daysAgo(21),
    notes: `${SEED_NOTE_PREFIX} Sliding window with last seen index.`,
    mistakeNotes: "Moved left pointer backwards.",
  },
  {
    name: "Climbing Stairs",
    topic: "DP",
    difficulty: "Easy",
    link: "https://leetcode.com/problems/climbing-stairs/",
    feltDifficulty: 2,
    confidence: 5,
    neededHint: false,
    neededSolution: false,
    revisionCount: 5,
    solvedWithoutHelpCount: 5,
    lastRevisedAt: daysAgo(1),
    notes: `${SEED_NOTE_PREFIX} Fibonacci style DP.`,
    mistakeNotes: "",
  },
  {
    name: "House Robber",
    topic: "DP",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/house-robber/",
    feltDifficulty: 4,
    confidence: 2,
    neededHint: true,
    neededSolution: true,
    revisionCount: 1,
    solvedWithoutHelpCount: 0,
    lastRevisedAt: daysAgo(18),
    notes: `${SEED_NOTE_PREFIX} Choose rob or skip at each index.`,
    mistakeNotes: "State transition was unclear.",
  },
  {
    name: "Number of Islands",
    topic: "Recursion",
    difficulty: "Medium",
    link: "https://leetcode.com/problems/number-of-islands/",
    feltDifficulty: 4,
    confidence: 3,
    neededHint: false,
    neededSolution: true,
    revisionCount: 0,
    solvedWithoutHelpCount: 0,
    lastRevisedAt: null,
    notes: `${SEED_NOTE_PREFIX} DFS flood fill over grid.`,
    mistakeNotes: "Forgot to mark visited before recursive calls.",
  },
  {
    name: "Valid Parentheses",
    topic: "Stack",
    difficulty: "Easy",
    link: "https://leetcode.com/problems/valid-parentheses/",
    feltDifficulty: 1,
    confidence: 5,
    neededHint: false,
    neededSolution: false,
    revisionCount: 4,
    solvedWithoutHelpCount: 4,
    lastRevisedAt: daysAgo(4),
    notes: `${SEED_NOTE_PREFIX} Basic stack matching.`,
    mistakeNotes: "",
  },
  {
    name: "Largest Rectangle in Histogram",
    topic: "Stack",
    difficulty: "Hard",
    link: "https://leetcode.com/problems/largest-rectangle-in-histogram/",
    feltDifficulty: 5,
    confidence: 1,
    neededHint: true,
    neededSolution: true,
    revisionCount: 0,
    solvedWithoutHelpCount: 0,
    lastRevisedAt: null,
    notes: `${SEED_NOTE_PREFIX} Monotonic stack with width calculation.`,
    mistakeNotes: "Width calculation after popping is still weak.",
  },
];

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST() {
  try {
    await connectToDatabase();

    await QuestionModel.deleteMany({
      notes: { $regex: `^\\${SEED_NOTE_PREFIX}` },
    });

    const questions = await QuestionModel.insertMany(seedQuestions.map(withScoreAndStatus));

    return Response.json({
      message: "Seed questions inserted.",
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error("POST /api/seed failed", error);
    return jsonError("Failed to seed questions.", 500);
  }
}

export async function DELETE() {
  try {
    await connectToDatabase();

    const result = await QuestionModel.deleteMany({
      notes: { $regex: `^\\${SEED_NOTE_PREFIX}` },
    });

    return Response.json({
      message: "Seed questions removed.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("DELETE /api/seed failed", error);
    return jsonError("Failed to remove seed questions.", 500);
  }
}
