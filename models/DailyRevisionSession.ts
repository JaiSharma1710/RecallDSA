import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const dailyRevisionSessionSchema = new Schema(
  {
    sessionDate: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    entries: {
      type: [
        {
          questionId: {
            type: Schema.Types.ObjectId,
            ref: "Question",
            required: true,
          },
          batchNumber: {
            type: Number,
            required: true,
            min: 1,
          },
          order: {
            type: Number,
            required: true,
            min: 0,
          },
          selectionReasons: {
            type: [String],
            default: [],
          },
        },
      ],
      default: [],
    },
  },
  {
    collection: "dailyRevisionSessions",
    timestamps: true,
  },
);

dailyRevisionSessionSchema.index({ sessionDate: 1 }, { unique: true });
dailyRevisionSessionSchema.index({ "entries.questionId": 1 });

export type DailyRevisionSession = InferSchemaType<typeof dailyRevisionSessionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const DailyRevisionSessionModel =
  (mongoose.models.DailyRevisionSession as Model<DailyRevisionSession> | undefined) ??
  mongoose.model<DailyRevisionSession>("DailyRevisionSession", dailyRevisionSessionSchema);

export default DailyRevisionSessionModel;
