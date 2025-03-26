import GroupPostCommentReaction from "../models/groupPostCommentReactionModel.js";
import { isValidObjectId } from "./apiService.js";

const formatGroupPostCommentReactionData = (reaction) => {
  return {
    id: reaction._id,
    groupPostComment: reaction.groupPostComment,
    user: reaction.user,
    createdAt: reaction.createdAt,
    updatedAt: reaction.updatedAt,
  };
};

export const getListGroupPostCommentReactions = async (req) => {
  try {
    const { commentId, userId, page = 1, limit = 10 } = req.query;
    const query = {};

    if (commentId) {
      if (!isValidObjectId(commentId)) {
        throw new Error("Invalid comment id");
      }
      query.groupPostComment = commentId;
    }

    if (userId) {
      if (!isValidObjectId(userId)) {
        throw new Error("Invalid user id");
      }
      query.user = userId;
    }

    const reactions = await GroupPostCommentReaction.find(query)
      .populate("groupPostComment", "content")
      .populate("user", "displayName avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GroupPostCommentReaction.countDocuments(query);

    return {
      reactions: reactions.map(formatGroupPostCommentReactionData),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw error;
  }
}; 