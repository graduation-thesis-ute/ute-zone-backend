import mongoose from "mongoose";
import PagePostComment from "../models/pagePostCommentModel.js";
import PagePost from "../models/pagePostModel.js"; 
import { isValidObjectId } from "./apiService.js";
import { formatDistanceToNow } from "../configurations/schemaConfig.js";
import PagePostReaction from "../models/pagePostReactionModel.js";
import CommentReaction from "../models/commentReactionModel.js";

const formatPagePostCommentData = async (comment, currentUser) => {
    comment.isOwner = comment.user._id.equals(currentUser._id) ? 1: 0;
    comment.isUpdated = comment.updatedAt.getTime() !== comment.createdAt.getTime() ? 1 : 0;
    comment.isReacted = (await CommentReaction.exists({
      user: currentUser._id,
      comment: comment._id,
    })) ? 1 : 0;
    comment.isChildren = comment.parent ? 1 : 0;
    comment.totalChildren = await PagePostComment.countDocuments({ parent: comment._id });
    const reactions = await PagePostReaction.find({ post: comment.pagePost });
    comment.totalReactions = reactions.length;
    const commentReactions = await CommentReaction.find({ comment: comment._id });
    comment.totalCommentReactions = commentReactions.length;
    const pagePost = await PagePost.findById(comment.pagePost);
    console.log("pagePost", pagePost);
    console.log("comment.totalReactions", comment.totalReactions);
    console.log("comment.isOwner", comment.isOwner);
    console.log("comment.isUpdated", comment.isUpdated);
    console.log("comment.isChildren", comment.isChildren);
    console.log("comment.totalChildren", comment.totalChildren);
    console.log("comment.post", comment.pagePost);
    return {
      _id: comment._id,
      post: {
        _id: comment.pagePost,
      },
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
      totalCommentReactions: comment.totalCommentReactions,
      ...(comment.isChildren === 1
        ? { parent: { _id: comment.parent } }
        : { totalChildren: comment.totalChildren }),
    };
};

const getPagePostListComments = async (req) => {
    const {
        pagePost,
        content,
        isPaged,
        parent,
        page = 0,
        ignoreChildren = "0",
        size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;
    const currentUser = req.user;
  
    const offset = parseInt(page, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);
  
    let query = {};

    if (isValidObjectId(parent)) {
      query.parent = new mongoose.Types.ObjectId(parent);
    }
    if (ignoreChildren === "1") {
      query.parent = null;
    }
    if (content) {
      query.content = { $regex: content, $options: "i" };
    }
    if (isValidObjectId(pagePost)) {
      const getPagePost = await PagePost.findById(pagePost);
      console.log("pagePost", getPagePost);
      query.pagePost = new mongoose.Types.ObjectId(pagePost);
    }
    const [totalElements, comments] = await Promise.all([
      PagePostComment.countDocuments(query),
      PagePostComment.find(query)
        .populate("user")
        .sort(ignoreChildren === "1" ? { createdAt: -1 } : { createdAt: 1 })
        .skip(offset)
        .limit(limit),
    ]);
  
    const totalPages = Math.ceil(totalElements / limit);
  
    const result = await Promise.all(
      comments.map(async (comment) => {
        return await formatPagePostCommentData(comment, currentUser);
      })
    );
  
    return {
      content: result,
      totalPages,
      totalElements,
    };
};

const toggleCommentReaction = async (req) => {
  const { commentId, reactionType = 1 } = req.body;
  const currentUser = req.user;

  if (!isValidObjectId(commentId)) {
    throw new Error("Invalid comment id");
  }

  const comment = await PagePostComment.findById(commentId);
  if (!comment) {
    throw new Error("Comment not found");
  }

  const existingReaction = await CommentReaction.findOne({
    user: currentUser._id,
    comment: commentId,
  });

  if (existingReaction) {
    await existingReaction.deleteOne();
    return { result: true, message: "Reaction removed" };
  }

  await CommentReaction.create({
    user: currentUser._id,
    comment: commentId,
    reactionType,
  });

  return { result: true, message: "Reaction added" };
};

export { 
  formatPagePostCommentData, 
  getPagePostListComments,
  toggleCommentReaction 
};
  
