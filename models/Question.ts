import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

import { normalizePlatforms } from "@/lib/platform";

export const QUESTION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const QUESTION_STATUSES = ["Red", "Orange", "Yellow", "Green"] as const;
export const QUESTION_PLATFORMS = [
  "leetcode",
  "gfg",
  "neetcode",
  "tuf",
  "manual",
] as const;
export const QUESTION_EXTERNAL_STATUSES = [
  "unsolved",
  "attempted",
  "accepted",
  "unknown",
] as const;

const questionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: QUESTION_DIFFICULTIES,
      required: true,
    },
    platform: {
      type: String,
      enum: QUESTION_PLATFORMS,
      default: "manual",
    },
    platforms: {
      type: [String],
      enum: QUESTION_PLATFORMS,
      default: ["manual"],
    },
    platformSlug: {
      type: String,
      trim: true,
      default: "",
    },
    platformProblemId: {
      type: String,
      trim: true,
      default: "",
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: "",
    },
    pageTitle: {
      type: String,
      trim: true,
      default: "",
    },
    externalStatus: {
      type: String,
      enum: QUESTION_EXTERNAL_STATUSES,
      default: "unknown",
    },
    capturedByExtension: {
      type: Boolean,
      default: false,
    },
    feltDifficulty: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    confidence: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    neededHint: {
      type: Boolean,
      default: false,
    },
    neededSolution: {
      type: Boolean,
      default: false,
    },
    revisionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    solvedWithoutHelpCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRevisedAt: {
      type: Date,
      default: null,
    },
    nextReviewAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: QUESTION_STATUSES,
      default: "Red",
    },
    weaknessScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    mistakeNotes: {
      type: String,
      trim: true,
      default: "",
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "questions",
    timestamps: true,
  },
);

questionSchema.pre("validate", function normalizeQuestionPlatforms() {
  const normalizedPlatforms = normalizePlatforms(
    Array.isArray(this.platforms) ? this.platforms : [],
    this.platform,
  );

  this.platforms = normalizedPlatforms;
  this.platform = normalizedPlatforms[0] ?? "manual";
});

questionSchema.index({ isArchived: 1, nextReviewAt: 1, weaknessScore: -1 });
questionSchema.index({ topic: 1, status: 1 });
questionSchema.index({ platform: 1, platformSlug: 1 });
questionSchema.index({ platforms: 1 });
questionSchema.index({ sourceUrl: 1 });

export type Question = InferSchemaType<typeof questionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const QuestionModel =
  (mongoose.models.Question as Model<Question> | undefined) ??
  mongoose.model<Question>("Question", questionSchema);

export default QuestionModel;
