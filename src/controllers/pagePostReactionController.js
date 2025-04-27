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

        // Kiểm tra xem người dùng đã like bài viết này chưa
        const existingReaction = await PagePostReaction.findOne({
            user: user._id,
            pagePost: pagePost
        });

        if (existingReaction) {
            // Nếu đã có reaction, cập nhật reaction type
            existingReaction.reactionType = reactionType;
            await existingReaction.save();
            return makeSuccessResponse({
                res,
                message: "Cập nhật reaction thành công",
                data: existingReaction
            });
        }

        const reaction = new PagePostReaction({
            user: user._id,
            pagePost,
            reactionType,
        });

        await reaction.save();

        // Lấy thông tin bài viết để gửi thông báo
        const post = await PagePost.findById(pagePost).populate('page', 'name avatarUrl');
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Bài viết không tồn tại'
            });
        }

        // Gửi thông báo nếu người like không phải là chủ bài viết
        if (post.user.toString() !== user._id.toString()) {
            await Notification.create({
                user: post.user,
                type: 'PAGE_POST_REACTION',
                content: `${user.fullName} đã thích bài viết của bạn`,
                data: {
                    pagePost: post._id,
                    page: post.page._id,
                    pageName: post.page.name,
                    pageAvatar: post.page.avatarUrl
                }
            });
        }

        res.json({
            success: true,
            message: 'Thích bài viết thành công',
            data: reaction
        });
    } catch (error) {
        console.error('Error creating reaction:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thích bài viết'
        });
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
            return makeErrorResponse({res, message: "Không tìm thấy reaction"});
        }
        await pagePostReaction.deleteOne();
        return makeSuccessResponse({
            res, 
            message: "Đã xóa reaction thành công",
            data: { deleted: true }
        });  
    } catch (error) {
        console.error('Error deleting reaction:', error);
        return makeErrorResponse({res, message: "Lỗi khi xóa reaction"});
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