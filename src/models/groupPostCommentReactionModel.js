import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";

const groupPostCommentReactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    groupPostComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupPostComment",
        required: true,
    },
    reactionType: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5, 6, 7],
        default: 1,
    },
}, schemaOptions);

const GroupPostCommentReaction = mongoose.model("GroupPostCommentReaction", groupPostCommentReactionSchema);

export default GroupPostCommentReaction;
