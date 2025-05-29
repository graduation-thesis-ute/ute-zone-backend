import { tr } from "date-fns/locale";
import GroupPostComment from "../models/groupPostCommentModel.js";
import GroupPostCommentReaction from "../models/groupPostCommentReactionModel.js"; 
import Notification from "../models/notificationModel.js";
import {
  isValidObjectId,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import { getListGroupPostCommentReactions } from "../services/groupPostCommentReactionService.js";

const createGroupPostCommentReaction = async (req, res) => {
  const { groupPostComment, reactionType } = req.body;
  const { user } = req; 
  if (!isValidObjectId(groupPostComment)) {
    return makeErrorResponse({ res, message: "Invalid group post comment" });
  }
  const getGroupPostComment = await GroupPostComment.findById(groupPostComment);
  if (!getGroupPostComment) {
    return makeErrorResponse({ res, message: "Group post comment not found" });
}
  const groupPostCommentReaction = await GroupPostCommentReaction.create({
    user: user._id,
    groupPostComment,
    reactionType,
  });
  await Notification.create({
    user: getGroupPostComment.user,
    data: {
      groupPost: {
        _id: getGroupPostComment.groupPost,
      },
      groupPostComment: {
        _id: getGroupPostComment._id,
      },
      user: {
        _id: user._id,
      },    
    },
    message: `${user.displayName} đã thả tim bình luận của bạn`,
  });
  return makeSuccessResponse({
    res,
    message: "Create group post comment reaction success",
  });
};

const deleteGroupPostCommentReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const groupPostCommentReaction = await GroupPostCommentReaction.findOne({
    _id: id,
    user: user._id,
  });
  if (!groupPostCommentReaction) {
    return makeErrorResponse({ res, message: "Group post comment reaction not found" });
  }
    await groupPostCommentReaction.deleteOne();
    return makeSuccessResponse({ res, message: "Delete group post comment reaction success" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const getGroupPostCommentReactions = async (req, res) => {
    try {
        const result = await getListGroupPostCommentReactions(req);
        return makeSuccessResponse({ res, result });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

export { 
    createGroupPostCommentReaction, 
    deleteGroupPostCommentReaction, 
    getGroupPostCommentReactions 
};

