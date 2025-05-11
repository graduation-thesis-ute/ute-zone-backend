import mongoose from "mongoose";
import GroupPostReaction from "../models/groupPostReactionModel.js";
import GroupPostCommentReaction from "../models/groupPostCommentReactionModel.js";
import GroupPost from "../models/groupPostModel.js";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import GroupPostComment from "../models/groupPostCommentModel.js";
import { isValidObjectId } from "./apiService.js";
import { formatDistanceToNow } from "../configurations/schemaConfig.js";

const formatGroupPostCommentData = async (comment, currentUser) => {
  comment.isOwner = comment.user._id.equals(currentUser._id) ? 1: 0;
  comment.isUpdated = comment.updatedAt.getTime() !== comment.createdAt.getTime() ? 1 : 0;
  comment.isReacted = (await CommentReaction.exists({
    user: currentUser._id,
    comment: comment._id,
  })) ? 1 : 0;
  comment.isChildren = comment.parent ? 1 : 0;
  comment.totalChildren = await GroupPostComment.countDocuments({ parent: comment._id });
  const reactions = await GroupPostReaction.find({ post: comment.groupPost });
  comment.totalReactions = reactions.length;
  const commentReactions = await GroupPostCommentReaction.find({ comment: comment._id });
  comment.totalCommentReactions = commentReactions.length;
  const groupPost = await GroupPost.findById(comment.groupPost);
  
  return {
    id: comment._id,
    groupPost:{
      _id: comment.groupPost,
    } ,
    user: {
      _id: comment.user._id,
      displayName: comment.user.displayName,
      avatarUrl: comment.user.avatarUrl,
    },
    content: comment.content,
    imageUrl: comment.imageUrl,
    createdAt: formatDistanceToNow(comment.createdAt),
    isOwner: comment.isOwner,
    isUpdated: comment.isUpdated,
    isReacted: comment.isReacted,
    isChildren: comment.isChildren,
    totalCommentReactions : comment.totalCommentReactions,
    ...(comment.isChildren === 1
      ? { parent: { _id: comment.parent } }
      : { totalChildren: comment.totalChildren }),
    totalReactions: comment.totalReactions,
  };
};

const getListGroupPostComments = async (req) => {
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

export { formatGroupPostCommentData, getListGroupPostComments };
