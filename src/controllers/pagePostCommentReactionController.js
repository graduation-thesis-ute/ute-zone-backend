import PagePostComment from "../models/pagePostCommentModel.js";
import PagePostCommentReaction from "../models/pagePostCommentReactionModel.js";
import Notification from "../models/notificationModel.js";
import {
  isValidObjectId,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import { getListPagePostCommentReactions } from "../services/pagePostCommentReactionService.js";

const createPagePostCommentReaction = async (req, res) => {
  try {
    const { pagePostComment, reactionType } = req.body;
    const { user } = req;
    if (!isValidObjectId(pagePostComment)) {
      return makeErrorResponse({ res, message: "Invalid page post comment" });
    }
    const getPagePostComment = await PagePostComment.findById(pagePostComment);
    if (!getPagePostComment) {
      return makeErrorResponse({ res, message: "Page post comment not found" });
    }
    const pagePostCommentReaction = await PagePostCommentReaction.create({
      user: user._id,
      pagePostComment,
      reactionType,
    });
    await Notification.create({
      user: getPagePostComment.user,
      data: {
        pagePost: {
          _id: getPagePostComment.pagePost,
        },
        pagePostComment: {
          _id: getPagePostComment._id,
        },
        user: {
          _id: user._id,
        },
      },
      message: `${user.displayName} đã thả tim bình luận của bạn`,
    });
    return makeSuccessResponse({
      res,
      message: "Create page post comment reaction success",
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const deletePagePostCommentReaction = async (req, res) => {
  try {
    const pagePostCommentReactionId = req.params.id;
    const pagePostCommentReaction = await PagePostCommentReaction.findOne({
      pagePostComment: pagePostCommentReactionId,
      user: req.user._id,
    });
    if (!pagePostCommentReaction) {
      return makeErrorResponse({ res, message: "Page post comment reaction not found" });
    }
    await pagePostCommentReaction.deleteOne();
    return makeSuccessResponse({ res, message: "Delete page post comment reaction success" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};  

const getPagePostCommentReactions = async (req, res) => {
  try {
    const result = await getListPagePostCommentReactions(req);
    return makeSuccessResponse({ res, data: result });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

export {
  createPagePostCommentReaction,
  deletePagePostCommentReaction,
  getPagePostCommentReactions,
};
