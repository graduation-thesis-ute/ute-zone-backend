import GroupPostReaction from "../models/groupPostReactionModel.js";
import GroupPost from "../models/groupPostModel.js";
import Notification from "../models/notificationModel.js";
import {
  isValidObjectId,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import { getListGroupPostReactions } from "../services/groupPostReactionService.js";

const createGroupPostReaction = async (req, res) => {
  try {
    const { groupPost } = req.body;
    const { user } = req;
    const { type } = req.body;
    if (!isValidObjectId(groupPost)) {
      return makeErrorResponse({ res, message: "Invalid group post" });
    }
    const getGroupPost = await GroupPost.findById(groupPost);
    await GroupPostReaction.create({
      user: user._id,
      groupPost,
      type,
    });
    if (!user._id.equals(getGroupPost.user)) {
      await Notification.create({
        user: getGroupPost.user,
        data: {
          groupPost: {
            _id: getGroupPost._id,
          },
          user: {
            _id: user._id,
          },
        },
        type: "groupPostReaction",
      });
    }
    return makeSuccessResponse({ res, message: "Group post reaction created successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const deleteGroupPostReaction = async (req, res) => {
  try {
    const { groupPostReaction } = req.body;
    const { user } = req;
    if (!isValidObjectId(groupPostReaction)) {
      return makeErrorResponse({ res, message: "Invalid group post reaction" });
    }
    const getGroupPostReaction = await GroupPostReaction.findById(groupPostReaction);
    if (!getGroupPostReaction) {
      return makeErrorResponse({ res, message: "Group post reaction not found" });
    }
    if (!getGroupPostReaction.user.equals(user._id)) {
      return makeErrorResponse({ res, message: "You are not allowed to delete this group post reaction" });
    }
    await GroupPostReaction.findByIdAndDelete(groupPostReaction);
    return makeSuccessResponse({ res, message: "Group post reaction deleted successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};  

const getGroupPostReactions = async (req, res) => {
  try {
    const { groupPost } = req.query;
    if (!isValidObjectId(groupPost)) {
      return makeErrorResponse({ res, message: "Invalid group post" });
    }
    const result = await getListGroupPostReactions(req);
    return makeSuccessResponse({ res, data: result });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};  

export { createGroupPostReaction, deleteGroupPostReaction, getGroupPostReactions };
