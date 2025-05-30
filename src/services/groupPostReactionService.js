import GroupPostReaction from "../models/groupPostReactionModel.js";
import { isValidObjectId } from "./apiService.js";

const formatGroupPostReactionData = (reaction) => {
  return {
    id: reaction._id,
    groupPost: reaction.groupPost,
    user: reaction.user,
    reactionType: reaction.reactionType,
    createdAt: reaction.createdAt,
    updatedAt: reaction.updatedAt,
  };
};

export const getListGroupPostReactions = async (req) => {
  try {
    const { postId, userId, page = 1, limit = 10 } = req.query;
    const query = {};

    if (postId) {
      if (!isValidObjectId(postId)) {
        throw new Error("Invalid post id");
      }
      query.groupPost = postId;
    }

    if (userId) {
      if (!isValidObjectId(userId)) {
        throw new Error("Invalid user id");
      }
      query.user = userId;
    }

    const reactions = await GroupPostReaction.find(query)
      .populate("groupPost", "content")
      .populate("user", "displayName avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GroupPostReaction.countDocuments(query);

    return {
      reactions: reactions.map(formatGroupPostReactionData),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw error;
  }
}; 