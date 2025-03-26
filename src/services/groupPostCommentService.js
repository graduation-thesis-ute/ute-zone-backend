import GroupPostComment from "../models/groupPostCommentModel.js";
import { isValidObjectId } from "./apiService.js";

const formatGroupPostCommentData = (comment) => {
  return {
    id: comment._id,
    groupPost: comment.groupPost,
    user: comment.user,
    content: comment.content,
    imageUrl: comment.imageUrl,
    parent: comment.parent,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
};

export const getListGroupPostComments = async (req) => {
  try {
    const { postId, userId, parentId, page = 1, limit = 10 } = req.query;
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

    if (parentId) {
      if (!isValidObjectId(parentId)) {
        throw new Error("Invalid parent comment id");
      }
      query.parent = parentId;
    }

    const comments = await GroupPostComment.find(query)
      .populate("groupPost", "content")
      .populate("user", "displayName avatarUrl")
      .populate("parent", "content")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GroupPostComment.countDocuments(query);

    return {
      comments: comments.map(formatGroupPostCommentData),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw error;
  }
}; 