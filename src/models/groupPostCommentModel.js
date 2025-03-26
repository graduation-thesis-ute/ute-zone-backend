import mongoose from "mongoose";

const groupPostCommentSchema = new mongoose.Schema(
  {
    groupPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupPost",
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
    imageUrl: {
      type: String,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupPostComment",
    },
  },
  {
    timestamps: true,
  }
);

const GroupPostComment = mongoose.model("GroupPostComment", groupPostCommentSchema);

export default GroupPostComment; 