import mongoose from "mongoose";

const processedRunSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
    },
    processedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ProcessedRun = mongoose.model("ProcessedRun", processedRunSchema);

export default ProcessedRun;
