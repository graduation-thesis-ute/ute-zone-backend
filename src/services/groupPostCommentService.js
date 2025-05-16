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
  comment.isReacted = (await GroupPostCommentReaction.exists({
    user: currentUser._id,
    groupPostComment: comment._id,
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
  const { 
    content, 
    groupPost, 
    parent, 
    page = 0, 
    isPaged = "0",
    ignoreChildren = "0",
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;
  const currentUser = req.user;

  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);

  const query = {};

  if (groupPost) {
    if (!isValidObjectId(groupPost)) {
      throw new Error("Invalid group post id");
    }
    query.groupPost = groupPost;
  }


  if (parent) {
    if (!isValidObjectId(parent)) {
      throw new Error("Invalid parent comment id");
    }
    query.parent = parent;
  }
  if (ignoreChildren === "1") {
    query.parent = null;
  }
  if(content) {
    query.content = { $regex: content, $options: "i" };
  }

  const [totalElements, comments] = await Promise.all([
    GroupPostComment.countDocuments(query),
    GroupPostComment.find(query)
      .populate("groupPost", "content")
      .populate("user", "displayName avatarUrl")
      .populate("parent", "content")
      .sort(ignoreChildren === "1" ? { createdAt: -1 } : { createdAt: 1 })
      .skip(offset)
      .limit(limit),
  ]);

  const totalPages = Math.ceil(totalElements / limit);

  const result = await Promise.all(
    comments.map(async (comment) => {
      return await formatGroupPostCommentData(comment, currentUser);
    })
  );

  return {
    content: result,
    totalPages,
    totalElements,
  };
}; 

export { formatGroupPostCommentData, getListGroupPostComments };
