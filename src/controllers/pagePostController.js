import Friendship from "../models/friendshipModel.js";
import Notification from "../models/notificationModel.js";
import PagePost from "../models/pagePostModel.js";
import PageMember from "../models/pageMemberModel.js";
import Page from "../models/pageModel.js";
import ModerationSetting from "../models/moderationSettingModel.js";
import {
  deleteFileByUrl,
  isValidUrl,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import { formatPagePostData, getListPagePosts } from "../services/pagePostService.js";
import { moderatePostContent } from "../services/contentModerationService.js";

// Controller for creating a page post
const createPost = async (req, res) => {
  try {
    const { content, imageUrls, kind, pageId } = req.body;
    const errors = [];

    const pageMember = await PageMember.findOne({ page: pageId, user: req.user._id });
    if (!pageMember || ![1, 2].includes(pageMember.role)) {
      return makeErrorResponse({ res, message: "You do not have permission to create a post on this page" });
    }

    // Validate incoming data
    if (!kind || ![1, 2, 3].includes(kind)) {
      errors.push({ field: "kind", message: "Invalid post kind" });
    }
    if (!content || !content.trim()) {
      errors.push({ field: "content", message: "Content cannot be null" });
    }
    if (errors.length > 0) {
      return makeErrorResponse({ res, message: "Invalid form", data: errors });
    }

    const { user } = req;

    // Lấy cài đặt duyệt bài cho page
    const moderationSetting = await ModerationSetting.findOne({
      entityType: 2, // Page
      entityId: pageId
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
        const post = await PagePost.create({
          user: user._id,
          content,
          imageUrls: imageUrls || [],
          page: pageId,
          status: 3, // Rejected
          kind,
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

    const validImageUrls =
      imageUrls?.map((url) => (isValidUrl(url) ? url : null)).filter(Boolean) ||
      [];

    // Chuẩn bị dữ liệu tạo bài viết
    const postData = {
      user: user._id,
      content,
      imageUrls: validImageUrls,
      page: pageId,
      status,
      kind,
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

    const post = await PagePost.create(postData);

    // Send notifications to friends
    const friendships = await Friendship.find({
      $or: [{ sender: user._id }, { receiver: user._id }],
      status: 2,
    });

    const allFriendNotifications = friendships.map((friendship) => {
      const friendId = friendship.sender.equals(user._id)
        ? friendship.receiver
        : friendship.sender;
      return {
        user: friendId,
        data: {
          user: { _id: user._id },
          post: { _id: post._id },
        },
        message: `${user.displayName} đã đăng bài viết mới`,
      };
    });

    if (allFriendNotifications.length > 0) {
      await Notification.insertMany(allFriendNotifications);
    }

    return makeSuccessResponse({ 
      res, 
      message,
      data: { status }
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};
const getPost = async (req, res) => {
  try {
    const id  = req.params.id;
    const currentUser = req.user;
  
    const post = await PagePost.findById(id).populate("user");

    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }
    const pageMember = await PageMember.findOne({ page: post.page, user: req.user._id });
    if (!pageMember || ![1, 2].includes(pageMember.role)) {
      return makeErrorResponse({ res, message: "You do not have permission to view this post on this page" });
    }
    const formattedPost = await formatPagePostData(post, currentUser);
    return makeSuccessResponse({ 
      res, 
      data: formattedPost });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};
// Controller for fetching page posts
const getPosts = async (req, res) => {
  try {
    
    const result = await getListPagePosts(req);
    return makeSuccessResponse({ 
      res, 
      data: result,
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Controller for updating a page post
const updatePost = async (req, res) => {
  try {
    const { id, content, status, imageUrls, kind } = req.body;
    const post = await PagePost.findById(id);

    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }
    const pageMember = await PageMember.findOne({ page: post.page, user: req.user._id });
    if (!pageMember || ![1, 2].includes(pageMember.role)) {
      return makeErrorResponse({ res, message: "You do not have permission to update this post on this page" });
    }

    // Handle image deletion
    const oldImageUrls = post.imageUrls || [];
    const imagesToDelete = oldImageUrls.filter(
      (url) => !imageUrls.includes(url)
    );
    for (const imageUrl of imagesToDelete) {
      await deleteFileByUrl(imageUrl);
    }

    await post.updateOne({
      content,
      kind,
      status: status || post.status,
      isUpdated: 1,
      imageUrls: imageUrls?.map((url) => (isValidUrl(url) ? url : null)).filter(Boolean) || [],
    });

    return makeSuccessResponse({ res, message: "Page post updated successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Controller for deleting a page post
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await PagePost.findById(id);

    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }
    const pageMember = await PageMember.findOne({ page: post.page, user: req.user._id });
    if (!pageMember || ![1, 2].includes(pageMember.role)) {
      return makeErrorResponse({ res, message: "You do not have permission to delete this post on this page" });
    }
    // Delete image files if necessary
    for (const imageUrl of post.imageUrls) {
      await deleteFileByUrl(imageUrl);
    }

    await post.deleteOne();
    return makeSuccessResponse({ res, message: "Page post deleted successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Controller for changing post status
const changeStatusPost = async (req, res) => {
  try {
    const { id, status, reason } = req.body;
    const { user } = req;

    const post = await PagePost.findById(id);

    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }

    const pageMember = await PageMember.findOne({ page: post.page, user: req.user._id });
    if (!pageMember || ![1, 2].includes(pageMember.role)) {
      return makeErrorResponse({ res, message: "You do not have permission to change status this post on this page" });
    }

    // Kiểm tra nếu bài viết đã được duyệt tự động
    if (post.autoModeration && post.status === 2) {
      return makeErrorResponse({
        res,
        message: "This post was auto moderated and cannot be manually moderated",
      });
    }

    if (!status || ![2, 3].includes(status)) {
      return makeErrorResponse({
        res,
        message: "Invalid post status",
      });
    }

    if (status === 3 && (!reason || !reason.trim())) {
      return makeErrorResponse({
        res,
        message: "Please provide reason when rejecting post",
      });
    }

    await post.updateOne({ 
      status,
      moderationNote: status === 3 ? reason : "Manually moderated by admin",
      autoModeration: false // Đánh dấu là đã được duyệt thủ công
    });

    if (!post.user._id.equals(user._id)) {
      await Notification.create({
        user: post.user._id,
        data: {
          user: {
            _id: post.user._id,
          },
          post: {
            _id: post.id,
          },
        },
        kind: status === 2 ? 2 : 3,
        message:
          status === 2
            ? "Your post has been approved successfully"
            : `Your post was rejected! Reason: ${reason}`,
      });
    }

    return makeSuccessResponse({ 
      res, 
      message: "Post status changed",
      data: { status, autoModeration: false }
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

export { 
  createPost, 
  getPosts, 
  updatePost, 
  deletePost, 
  getPost, 
  changeStatusPost 
};
