import mongoose from "mongoose";

const groupPostSchema = new mongoose.Schema(
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
    content: {
      type: String,
      required: true,
    },
    imageUrls: [{
      type: String,
    }],
    status: {
      type: Number,
      enum: [1, 2, 3], // 1: pending, 2: approved, 3: rejected
      default: 1,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const GroupPost = mongoose.model("GroupPost", groupPostSchema);

export default GroupPost; 