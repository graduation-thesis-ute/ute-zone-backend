import GroupPostComment from "../models/groupPostCommentModel.js";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import GroupPost from "../models/groupPostModel.js";    
import {
    deleteFileByUrl,
    isValidObjectId,
    isValidUrl,
    makeErrorResponse,
    makeSuccessResponse,
} from "../services/apiService.js";
import {
    formatGroupPostCommentData,
    getListGroupPostComments,
} from "../services/groupPostCommentService.js";
import Notification from "../models/notificationModel.js";

const createComment = async (req, res) => {
    try {
        const { groupPost, content, parent, imageUrl } = req.body;
        const errors = [];
        if (!groupPost) {
            errors.push({ field: "groupPost", message: "post cannot be null" });
        } else if (!isValidObjectId(groupPost)) {
            errors.push({ field: "groupPost", message: "post id is invalid" });
        }
        if (!content || !content.trim()) {
            errors.push({ field: "content", message: "content cannot be null" });
        }
        if (parent && !isValidObjectId(parent)) {
            errors.push({ field: "parent", message: "parent id is invalid" });
        }
        if (errors.length > 0) {
            return makeErrorResponse({ res, message: "Invalid form", data: errors });
        }

        const getPost = await GroupPost.findById(groupPost);
        if (!getPost) {
            return makeErrorResponse({ res, message: "Post not found" });
        }
        const group = await Group.findById(getPost.group);
        if (!group) {
            errors.push({ field: "group", message: "group not found" });
        }
        const groupMember = await GroupMember.findOne({
            group: getPost.group,
            user: req.user._id,
        });
        if (!groupMember) {
            errors.push({ field: "groupMember", message: "you are not a member of this group" });
        }
        if (errors.length > 0) {
            return makeErrorResponse({ res, message: "Invalid form", data: errors });
        }
        const currentUser = req.user;
        let parentComment;
        if (parent) {
            parentComment = await GroupPostComment.findById(parent);
            if (!parentComment) {
                errors.push({ field: "parent", message: "parent comment not found" });
            }
        }
        const comment = await GroupPostComment.create({
            groupPost: getPost._id,
            content,
            user: currentUser._id,
            parent: parentComment ? parentComment._id : null    ,
            imageUrl: isValidUrl(imageUrl) ? imageUrl : null,
        });
        if (parentComment) {
            if (!currentUser._id.equals(parentComment.user._id)) {
                await Notification.create({
                    user: parentComment.user._id,
                    data: {
                        type: "comment",
                        groupPost: getPost._id,
                        comment: comment._id,
                    },
                });
            }
        }
        if (!currentUser._id.equals(getPost.user._id)) {
            await Notification.create({
                user: getPost.user._id,
                message: "Bài viết của bạn có bình luận mới.",
                data: {
                    type: "comment",    
                    groupPost: getPost._id,
                    comment: comment._id,
                },
            });
        }
        const formattedComment = await formatGroupPostCommentData(comment, currentUser);
        return makeSuccessResponse({ res, message: "Comment created successfully", data: formattedComment });
    } catch (error) {
        return makeErrorResponse({ res, message: "Internal server error", data: error.message });
    }
};
const updateComment = async (req, res) => {
    try {
        const { id, content, imageUrl } = req.body;
        if (!isValidObjectId(id)) {
            return makeErrorResponse({ res, message: "Invalid id" });
        }   
        const comment = await GroupPostComment.findById(id);
        if (!comment) {
            return makeErrorResponse({ res, message: "Comment not found" });
        }
        if (!currentUser._id.equals(comment.user._id)) {
            return makeErrorResponse({ res, message: "You are not allowed to update this comment" });
        }
        comment.content = content;
        comment.imageUrl = isValidUrl(imageUrl) ? imageUrl : null;
        await comment.save();
        const formattedComment = await formatGroupPostCommentData(comment, currentUser);
        return makeSuccessResponse({ res, message: "Comment updated successfully", data: formattedComment });   
    } catch (error) {
        return makeErrorResponse({ res, message: "Internal server error", data: error.message });
    }
};
const deleteComment = async (req, res) => { 
    try {
        const { id } = req.body;
        if (!isValidObjectId(id)) {
            return makeErrorResponse({ res, message: "Invalid id" });
        }
        const comment = await GroupPostComment.findById(id);
        if (!comment) {
            return makeErrorResponse({ res, message: "Comment not found" });
        }
        await comment.deleteOne();
        return makeSuccessResponse({ res, message: "Comment deleted successfully" });
    } catch (error) {
        return makeErrorResponse({ res, message: "Internal server error", data: error.message });
    }
};
const getComment = async (req, res) => {
    try {
        const { id } = req.body;
        if (!isValidObjectId(id)) {
            return makeErrorResponse({ res, message: "Invalid id" });
        }
        const comment = await GroupPostComment.findById(id);
        if (!comment) {
            return makeErrorResponse({ res, message: "Comment not found" });
        }
        const formattedComment = await formatGroupPostCommentData(comment, currentUser);
        return makeSuccessResponse({ res, message: "Comment fetched successfully", data: formattedComment });
    } catch (error) {
        return makeErrorResponse({ res, message: "Internal server error", data: error.message });
    }
};          
const getComments = async (req, res) => {       
    try {
        const result = await getListGroupPostComments(req);
       return makeSuccessResponse({
        res,
        data: result,
       })
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

export {
    createComment,
    updateComment,
    deleteComment,
    getComment,
    getComments,
};


