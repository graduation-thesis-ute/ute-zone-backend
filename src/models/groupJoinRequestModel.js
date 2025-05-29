import mongoose from "mongoose";

const groupJoinRequestSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: Number,
      enum: [0, 1, 2, 3], // 1: pending, 2: approved, 3: rejected 0.accepted
      default: 1,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const GroupJoinRequest = mongoose.model("GroupJoinRequest", groupJoinRequestSchema);

export default GroupJoinRequest; 