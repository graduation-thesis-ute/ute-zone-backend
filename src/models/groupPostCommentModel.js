import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";
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
      default: null,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupPostComment",
      default: null,
    },
  },
  schemaOptions
);

const GroupPostComment = mongoose.model("GroupPostComment", groupPostCommentSchema);

export default GroupPostComment; 