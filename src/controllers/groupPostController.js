import GroupPost from "../models/groupPostModel.js";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { deleteFileByUrl, isValidUrl, makeErrorResponse, makeSuccessResponse } from "../services/apiService.js";
import { isValidObjectId } from "mongoose";
import { getListGroupPosts, formatGroupPostData } from "../services/groupPostService.js";
import ModerationSetting from "../models/moderationSettingModel.js";
import { moderatePostContent } from "../services/contentModerationService.js";

const createGroupPost = async (req, res) => {
    try {
        const { groupId, content, imageUrls } = req.body;
        const errors = [];

        if (!isValidObjectId(groupId)) {
            return makeErrorResponse({ res, message: "Invalid group ID" });
        }

        const groupMember = await GroupMember.findOne({ group: groupId, user: req.user._id });
        if (!groupMember) {
            return makeErrorResponse({ res, message: "You are not a member of this group" });
        }

        if (!content || !content.trim()) {
            errors.push({ field: "content", message: "Content cannot be null" });
        }

        if (errors.length > 0) {
            return makeErrorResponse({ res, message: "Invalid form", data: errors });
        }

        const { user } = req;

        // Lấy cài đặt duyệt bài cho group
        const moderationSetting = await ModerationSetting.findOne({
            entityType: 3, // Group
            entityId: groupId
        });

        let status = 1; // Mặc định là pending
        let message = "Bài viết đã được tạo và đang chờ duyệt";

        // Kiểm tra nội dung nếu bật duyệt tự động
        if (moderationSetting?.isModerationRequired && moderationSetting.isAutoModerationEnabled) {
            try {
                const moderationResult = await moderatePostContent({
                    content,
                    imageUrls: imageUrls || []
                });

                if (!moderationResult.isSafe) {
                    return makeErrorResponse({ 
                        res, 
                        message: "Nội dung bài viết vi phạm quy định", 
                        data: {
                            flaggedCategories: moderationResult.flaggedCategories,
                            details: {
                                textAnalysis: moderationResult.textAnalysis,
                                imageAnalysis: moderationResult.imageAnalysis
                            }
                        }
                    });
                }
                // Nếu nội dung an toàn và bật duyệt tự động
                status = 2; // Approved
                message = "Bài viết đã được tạo và tự động duyệt thành công";
            } catch (error) {
                // Nếu có lỗi khi kiểm tra nội dung, chuyển sang chờ duyệt thủ công
                console.error("Error during content moderation:", error.message);
                status = 1; // Pending
                message = "Bài viết đã được tạo và đang chờ duyệt (hệ thống kiểm tra nội dung tạm thời không khả dụng)";
            }
        } else if (!moderationSetting?.isModerationRequired) {
            // Nếu không yêu cầu duyệt bài
            status = 2; // Approved
            message = "Bài viết đã được tạo thành công";
        }

        const validImageUrls = imageUrls?.map((url) => (isValidUrl(url) ? url : null)).filter(Boolean) || [];

        const post = await GroupPost.create({
            group: groupId,
            user: user._id,
            content,
            imageUrls: validImageUrls,
            status
        });

        return makeSuccessResponse({ 
            res, 
            message,
            data: { status }
        });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

const getGroupPosts = async (req, res) => {
    try {
        const result = await getListGroupPosts(req);
        return makeSuccessResponse({ res, data: result });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

const updateGroupPost = async (req, res) => {
    try {
        
        const {id, content, imageUrls } = req.body;
        const userId = req.user._id;
        const groupPost = await GroupPost.findById(id);

        if (!groupPost) {
            return makeErrorResponse({ res, message: "Post not found" });
        }

        const groupMember = await GroupMember.findOne({ group: groupPost.group, user: userId });
        if (!groupMember || groupMember.role === 3) {
            return makeErrorResponse({ res, message: "You don't have permission to update this post" });
        }

        if (groupPost.user.toString() !== userId.toString()) {
            return makeErrorResponse({ res, message: "You are not the author of this post" });
        }

        const oldImageUrls = groupPost.imageUrls || [];
        const imagesToDelete = oldImageUrls.filter(
            (url) => !imageUrls.includes(url)
        );
        for (const imageUrl of imagesToDelete) {
            await deleteFileByUrl(imageUrl);
        }

        await groupPost.updateOne({
            content,
            imageUrls: imageUrls
                ? imageUrls
                    .map((imageUrl) => (isValidUrl(imageUrl) ? imageUrl : null))
                    .filter((url) => url !== null)
                : []
        }); 
        
        return makeSuccessResponse({ res, message: "Post updated successfully" });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

const deleteGroupPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;

        if (!isValidObjectId(postId)) {
            return makeErrorResponse({ res, message: "Invalid post ID" });
        }

        const post = await GroupPost.findById(postId);
        if (!post) {
            return makeErrorResponse({ res, message: "Post not found" });
        }

        const groupMember = await GroupMember.findOne({ group: post.group, user: userId });
        if (!groupMember || (groupMember.role === 3 && post.author.toString() !== userId.toString())) {
            return makeErrorResponse({ res, message: "You don't have permission to delete this post" });
        }

        await post.deleteOne();
        return makeSuccessResponse({ res, message: "Post deleted successfully" });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};
const getPost = async (req, res) => {
    try {
        const id  = req.params.id;
        const currentUser = req.user;
        console.log(id);
        const post = await GroupPost.findById(id);
        if (!post) {
            return makeErrorResponse({ res, message: "Post not found" });
        }
        const groupMember = await GroupMember.findOne({ group: post.group, user: currentUser._id });
        if (!groupMember) {
            return makeErrorResponse({ res, message: "You are not a member of this group" });
        }
        const formattedPost = await formatGroupPostData(post, currentUser); 

        return makeSuccessResponse({ res, data: formattedPost });   
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
}
const changePostStatus = async (req, res) => {
    try {
        const { id, status } = req.body;
        const {user } = req;

        if (!isValidObjectId(id)) {
            return makeErrorResponse({ res, message: "Invalid post ID" });
        }

        const post = await GroupPost.findById(id);
        if (!post) {
            return makeErrorResponse({ res, message: "Post not found" });
        }

        const groupMember = await GroupMember.findOne({ group: post.group, user: user._id });
        if (!groupMember || groupMember.role === 3) {
            return makeErrorResponse({ res, message: "You don't have permission to change post status" });
        }

        if (post.status !== 1) {
            return makeErrorResponse({ res, message: "Not allowed to change this post status" });
        }

        if (!status || ![2, 3].includes(status)) {
            return makeErrorResponse({ res, message: "Invalid post status" });
        }

        await post.updateOne({ status });
        // if (!post.user._id.equals(user._id)) {
        //     await Notification.create({
        //         user: post.user._id,
        //         data: {
        //             user: {
        //                 _id: post.user._id,
        //             },
        //             post: {
        //                 _id: post.id,
        //             },
        //         },
        //         kind: status === 2 ? 2 : 3,
        //         message:
        //             status === 2
        //                 ? "Your post has been approved successfully"
        //                 : `Your post was rejected! Reason: ${reason}`,
        //     });
        // }
            return makeSuccessResponse({ res, message: "Post status changed" });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

export {
    createGroupPost,
    getGroupPosts,
    updateGroupPost,
    deleteGroupPost,
    changePostStatus,
    getPost
}; 