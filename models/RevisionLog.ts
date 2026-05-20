import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const revisionLogSchema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    revisedAt: {
      type: Date,
      default: Date.now,
    },
    solvedWithoutHelp: {
      type: Boolean,
      required: true,
    },
    neededHint: {
      type: Boolean,
      required: true,
    },
    neededSolution: {
      type: Boolean,
      required: true,
    },
    confidenceAfter: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    feltDifficultyAfter: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    timeTakenMinutes: {
      type: Number,
      min: 0,
      default: null,
    },
    mistakeNotes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    collection: "revisionLogs",
    timestamps: true,
  },
);

revisionLogSchema.index({ questionId: 1, revisedAt: -1 });

export type RevisionLog = InferSchemaType<typeof revisionLogSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const RevisionLogModel =
  (mongoose.models.RevisionLog as Model<RevisionLog> | undefined) ??
  mongoose.model<RevisionLog>("RevisionLog", revisionLogSchema);

export default RevisionLogModel;
