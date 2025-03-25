import Notification from "../models/notificationModel.js";
import PagePost from "../models/pagePostModel.js";
import PagePostReaction from "../models/pagePostReactionModel.js";
import {
    isValidObjectId,
    makeErrorResponse,
    makeSuccessResponse,
  } from "../services/apiService.js";
  import { getListPagePostReactions } from "../services/pagePostReactionService.js";

  const createPagePostReaction = async (req, res) => {
    try {
        const {pagePost, reactionType} = req.body;
        const {user} = req;
        if (!isValidObjectId(pagePost)) {
            return makeErrorResponse({ res, message: "Invalid post" });
        }
        console.log(pagePost, user, reactionType);
        const getPagePost = await PagePost.findById(pagePost);
            await PagePostReaction.create({
                user: user._id,
                pagePost,
                reactionType,
                });
                if (!user._id.equals(getPagePost.user))
                {
                    await Notification.create({
                        user: getPagePost.user,
                        data: {
                        pagePost: {
                            _id: getPagePost._id,
                        },
                        user: {
                            _id: user._id,
                        },
                    },
                message: `${user.displayName} đã thả tim bài đăng của bạn`,
            });
        }
        return makeSuccessResponse({ res, message: "Reaction created successfully" });
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
  };
  const deletePagePostReaction = async (req, res) => {
    try {
        const pagePostId = req.params.id;
        const pagePostReaction = await PagePostReaction.findOne({
        pagePost: pagePostId,
        user: req.user._id,
    });
    if (!pagePostReaction) {
        makeErrorResponse({res, message: "Page Post reaction not found"});
    }
    await pagePostReaction.deleteOne();
    return makeSuccessResponse({
        res, 
        message: "Page Post reaction deleted successfully",
    });  
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
  }

  const getPagePostReactions = async (req, res) => {
    try {
        const result = await getListPagePostReactions(req);
        return makeSuccessResponse({
            res,
            data: result,
        })
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
  }

  export { createPagePostReaction, deletePagePostReaction, getPagePostReactions}