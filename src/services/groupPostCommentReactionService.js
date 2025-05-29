import GroupPostCommentReaction from "../models/groupPostCommentReactionModel.js";
import { isValidObjectId } from "./apiService.js";

const formatGroupPostCommentReactionData = (groupPostCommentReaction) => {
  return {
    _id: groupPostCommentReaction._id,
    groupPostComment: {
      _id: groupPostCommentReaction.groupPostComment._id,
    },
    user: {
      _id: groupPostCommentReaction.user._id,
      displayName: groupPostCommentReaction.user.displayName,
      avatarUrl: groupPostCommentReaction.user.avatarUrl,
    },
    reactionType: groupPostCommentReaction.reactionType,
  };
};

const getListGroupPostCommentReactions = async (req) => {
  try {
    const { 
      groupPostComment, 
      isPaged,
      page = 0,
      size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;
    const query = {};

    if (groupPostComment) {
      if (!isValidObjectId(groupPostComment)) {
        throw new Error("Invalid group post comment id");
      }
      query.groupPostComment = groupPostComment;
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
      content: reactions.map(formatGroupPostCommentReactionData),
      totalPages,
      totalElements,
    };
  } catch (error) {
    throw error;
  }
};  

export { getListGroupPostCommentReactions };
