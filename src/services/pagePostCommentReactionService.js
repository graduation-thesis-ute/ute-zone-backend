import mongoose from "mongoose";
import PagePostCommentReaction from "../models/pagePostCommentReactionModel.js";

const formatPagePostCommentReactionData = (pagePostCommentReaction) => {
  return {
    _id: pagePostCommentReaction._id,
    user: {
      _id: pagePostCommentReaction.user._id,
      displayName: pagePostCommentReaction.user.displayName,
      avatarUrl: pagePostCommentReaction.user.avatarUrl,
    },
    pagePostComment: {
      _id: pagePostCommentReaction.pagePostComment._id,
    },
    reactionType: pagePostCommentReaction.reactionType,
  };
};  

const getListPagePostCommentReactions = async (req) => {
  const {
    pagePostComment,
    isPaged,
    page = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;

  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);

  let query = {};
  if (mongoose.isValidObjectId(pagePostComment)) {
    query.pagePostComment = new mongoose.Types.ObjectId(pagePostComment);
  }

  const [totalElements, pagePostCommentReactions] = await Promise.all([ 
    PagePostCommentReaction.countDocuments(query),
    PagePostCommentReaction.find(query)
      .skip(offset)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("user", "displayName avatarUrl")
      .populate("pagePostComment", "_id")
  ]);

  const totalPages = Math.ceil(totalElements / limit);

  const result = pagePostCommentReactions.map((pagePostCommentReaction) => {
    return formatPagePostCommentReactionData(pagePostCommentReaction);
  });

  return {
    content: result,
    totalPages,
    totalElements,
  };
};

export { getListPagePostCommentReactions };
