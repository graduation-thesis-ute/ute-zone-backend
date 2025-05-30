import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";

const GroupPostReactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupPost",
      required: true,
    },
    reactionType: {
      type: Number,
      required: true,
      enum: [1,2,3,4,5,6, 7], // 1: Thích, 2: Yêu thích, 3: Haha, 4: Wow, 5: Buồn, 6: Phẫn nộ, 7: Thương thương
      default: 1, // Mặc định là Thích
    },
  },
  schemaOptions
);

const GroupPostReaction = mongoose.model("GroupPostReaction", GroupPostReactionSchema);
export default GroupPostReaction;
