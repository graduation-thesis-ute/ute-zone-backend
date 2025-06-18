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

        // LUÔN kiểm tra nội dung nhạy cảm để phát hiện từ ngữ không phù hợp
        let moderationResult = null;
        let hasSensitiveContent = false;

        try {
            moderationResult = await moderatePostContent({
                content,
                imageUrls: imageUrls || []
            });

            // Ghi nhận nếu có nội dung nhạy cảm
            if (!moderationResult.isSafe) {
                hasSensitiveContent = true;
                console.log('Content flagged by moderation:', {
                    content,
                    flaggedCategories: moderationResult.flaggedCategories,
                    confidence: moderationResult.confidence
                });
            }
        } catch (error) {
            // Nếu có lỗi khi kiểm tra nội dung, chuyển sang chờ duyệt thủ công
            console.error("Error during content moderation:", error.message);
            status = 1; // Pending
            message = "Bài viết đã được tạo và đang chờ duyệt (hệ thống kiểm tra nội dung tạm thời không khả dụng)";
        }

        // Xử lý kết quả kiểm tra nội dung
        if (hasSensitiveContent) {
            // Nếu bật tự động duyệt và có nội dung nhạy cảm -> từ chối
            if (moderationSetting?.isModerationRequired && moderationSetting.isAutoModerationEnabled) {
                // Tạo bài viết với trạng thái rejected (3)
                const post = await GroupPost.create({
                    group: groupId,
                    user: user._id,
                    content,
                    imageUrls: imageUrls?.map((url) => (isValidUrl(url) ? url : null)).filter(Boolean) || [],
                    status: 3, // Rejected
                    moderationNote: "Nội dung vi phạm quy định",
                    flaggedCategories: moderationResult.flaggedCategories,
                    moderationDetails: {
                        textAnalysis: moderationResult.textAnalysis,
                        imageAnalysis: moderationResult.imageAnalysis,
                        confidence: moderationResult.confidence
                    }
                });

                return makeSuccessResponse({ 
                    res, 
                    message: "Bài viết đã được tạo nhưng bị từ chối do vi phạm quy định",
                    data: {
                        status: post.status,
                        flaggedCategories: moderationResult.flaggedCategories,
                        moderationDetails: {
                            textAnalysis: moderationResult.textAnalysis,
                            imageAnalysis: moderationResult.imageAnalysis
                        }
                    }
                });
            } else {
                // Nếu tắt tự động duyệt hoặc tắt moderation -> chờ duyệt thủ công
                status = 1; // Pending - chờ duyệt thủ công
                message = "Bài viết đã được tạo và đang chờ duyệt (phát hiện nội dung có thể nhạy cảm)";
            }
        } else {
            // Nếu nội dung an toàn
            if (moderationSetting?.isModerationRequired) {
                // Nếu bật tự động duyệt và nội dung an toàn
                if (moderationSetting.isAutoModerationEnabled) {
                    status = 2; // Approved
                    message = "Bài viết đã được tạo và tự động duyệt thành công";
                } else {
                    status = 1; // Pending
                    message = "Bài viết đã được tạo và đang chờ duyệt";
                }
            } else {
                // Nếu không yêu cầu duyệt bài
                status = 2; // Approved
                message = "Bài viết đã được tạo thành công";
            }
        }

        const validImageUrls = imageUrls?.map((url) => (isValidUrl(url) ? url : null)).filter(Boolean) || [];

        // Chuẩn bị dữ liệu tạo bài viết
        const postData = {
            group: groupId,
            user: user._id,
            content,
            imageUrls: validImageUrls,
            status
        };

        // Thêm thông tin moderation nếu có nội dung nhạy cảm
        if (hasSensitiveContent && moderationResult) {
            postData.moderationNote = "Nội dung có thể nhạy cảm, cần duyệt thủ công";
            postData.flaggedCategories = moderationResult.flaggedCategories;
            postData.moderationDetails = {
                textAnalysis: moderationResult.textAnalysis,
                imageAnalysis: moderationResult.imageAnalysis,
                confidence: moderationResult.confidence
            };
        }

        const post = await GroupPost.create(postData);

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