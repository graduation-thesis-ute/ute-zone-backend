import Friendship from "../models/friendshipModel.js";
import Notification from "../models/notificationModel.js";
import Post from "../models/postModel.js";
import {
  deleteFileByUrl,
  isValidUrl,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import { formatPostData, getListPosts } from "../services/postService.js";
import {
  validatePostsPerDay,
  getValidPostStatus,
} from "../services/settingService.js";
import ModerationSetting from "../models/moderationSettingModel.js";
import { moderatePostContent } from "../services/contentModerationService.js";

const createPost = async (req, res) => {
  try {
    const { content, imageUrls, kind } = req.body;
    const userId = req.user.id;

    // Validate input data
    if (!kind || ![1, 2, 3].includes(kind)) {
      return res.status(400).json({
        result: false,
        message: "Loại bài viết không hợp lệ",
        data: null
      });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({
        result: false,
        message: "Nội dung bài viết không được để trống",
        data: null
      });
    }

    // Kiểm tra số lượng bài viết mỗi ngày
    const isAllowed = await validatePostsPerDay(req.user);
    if (!isAllowed) {
      return res.status(400).json({
        result: false,
        message: "Bạn đã đăng đủ số bài viết cho phép trong ngày",
        data: null
      });
    }

    // Kiểm tra nội dung
    let moderationResult;
    try {
      moderationResult = await moderatePostContent({ content, imageUrls });
      // Log kết quả kiểm duyệt chi tiết
      console.log('Moderation result:', JSON.stringify(moderationResult, null, 2));
    } catch (error) {
      // Xử lý lỗi quota OpenAI
      if (error.message.includes('429') || error.message.includes('quota')) {
        console.log('OpenAI API quota exceeded, falling back to manual moderation');
        // Lấy cài đặt duyệt nội dung toàn cục
        const globalSetting = await ModerationSetting.findOne({ entityType: 1 }); // 1 = global setting
        
        let post;
        let message;

        // Nếu không có cài đặt hoặc yêu cầu duyệt, tạo bài viết với trạng thái pending
        if (!globalSetting || globalSetting.isModerationRequired) {
          post = await Post.create({
            user: userId,
            content,
            imageUrls: imageUrls || [],
            kind,
            status: 1, // Pending
          });
          message = "Bài viết đã được tạo và đang chờ duyệt (hệ thống kiểm tra nội dung tạm thời không khả dụng)";
        } else {
          // Nếu không yêu cầu duyệt, tạo bài viết với trạng thái approved
          post = await Post.create({
            user: userId,
            content,
            imageUrls: imageUrls || [],
            kind,
            status: 2, // Approved
          });
          message = "Bài viết đã được tạo thành công (hệ thống kiểm tra nội dung tạm thời không khả dụng)";
        }

        // Gửi thông báo cho bạn bè
        try {
          const friendships = await Friendship.find({
            $or: [{ sender: userId }, { receiver: userId }],
            status: 2, // Đã là bạn
          });

          const notifications = friendships.map(friendship => {
            const friendId = friendship.sender.equals(userId)
              ? friendship.receiver
              : friendship.sender;
            return {
              user: friendId,
              data: {
                user: { _id: userId },
                post: { _id: post._id },
              },
              message: `${req.user.displayName} đã đăng bài viết mới`,
              kind: 1, // Thông báo bài viết mới
            };
          });

          if (notifications.length > 0) {
            await Notification.insertMany(notifications);
          }
        } catch (notifyError) {
          console.error("Error sending notifications:", notifyError);
          // Không ảnh hưởng đến kết quả tạo bài viết
        }

        return res.status(201).json({
          result: true,
          message,
          data: {
            status: post.status
          }
        });
      }
      // Nếu là lỗi khác, throw để xử lý ở catch block bên ngoài
      throw error;
    }

    // Nếu nội dung không an toàn
    if (!moderationResult.isSafe) {
      console.log('Content flagged by moderation:', {
        content,
        flaggedCategories: moderationResult.flaggedCategories,
        confidence: moderationResult.confidence,
        rawResponse: moderationResult.rawResponse
      });

      // Tạo bài viết với trạng thái rejected (3)
      const post = await Post.create({
        user: userId,
        content,
        imageUrls: imageUrls || [],
        kind,
        status: 3, // Rejected
        moderationNote: "Nội dung vi phạm quy định",
        flaggedCategories: moderationResult.flaggedCategories,
        moderationDetails: {
          textAnalysis: moderationResult.textAnalysis,
          imageAnalysis: moderationResult.imageAnalysis,
          confidence: moderationResult.confidence
        }
      });

      return res.status(201).json({
        result: true,
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
    }

    // Lấy cài đặt duyệt nội dung toàn cục
    const globalSetting = await ModerationSetting.findOne({ entityType: 1 }); // 1 = global setting
    
    let post;
    let message;

    // Nếu không có cài đặt hoặc yêu cầu duyệt
    if (!globalSetting || globalSetting.isModerationRequired) {
      // Nếu bật tự động duyệt và nội dung an toàn
      if (globalSetting?.isAutoModerationEnabled) {
        post = await Post.create({
          user: userId,
          content,
          imageUrls: imageUrls || [],
          kind,
          status: 2, // Approved
        });
        message = "Bài viết đã được tạo và tự động duyệt thành công";
      } else {
        post = await Post.create({
          user: userId,
          content,
          imageUrls: imageUrls || [],
          kind,
          status: 1, // Pending
        });
        message = "Bài viết đã được tạo và đang chờ duyệt";
      }
    } else {
      // Nếu không yêu cầu duyệt
      post = await Post.create({
        user: userId,
        content,
        imageUrls: imageUrls || [],
        kind,
        status: 2, // Approved
      });
      message = "Bài viết đã được tạo thành công";
    }

    // Gửi thông báo cho bạn bè
    try {
      const friendships = await Friendship.find({
        $or: [{ sender: userId }, { receiver: userId }],
        status: 2, // Đã là bạn
      });

      const notifications = friendships.map(friendship => {
        const friendId = friendship.sender.equals(userId)
          ? friendship.receiver
          : friendship.sender;
        return {
          user: friendId,
          data: {
            user: { _id: userId },
            post: { _id: post._id },
          },
          message: `${req.user.displayName} đã đăng bài viết mới`,
          kind: 1, // Thông báo bài viết mới
        };
      });

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (notifyError) {
      console.error("Error sending notifications:", notifyError);
      // Không ảnh hưởng đến kết quả tạo bài viết
    }

    return res.status(201).json({
      result: true,
      message,
      data: {
        status: post.status
      }
    });

  } catch (error) {
    console.error("Error during post creation:", error);
    return res.status(500).json({
      result: false,
      message: "Lỗi server khi tạo bài viết: " + error.message,
      data: null
    });
  }
};

const updatePost = async (req, res) => {
  try {
    const { id, content, imageUrls, kind } = req.body;
    const post = await Post.findById(id).populate("user");
    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }
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
      status: post.status === 3 ? 1 : post.status,
      isUpdated: 1,
      imageUrls: imageUrls
        ? imageUrls
            .map((imageUrl) => (isValidUrl(imageUrl) ? imageUrl : null))
            .filter((url) => url !== null)
        : [],
    });
    return makeSuccessResponse({ res, message: "Post updated" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const changeStatusPost = async (req, res) => {
  try {
    const { id, status, reason } = req.body;
    const { user } = req;
    const post = await Post.findById(id).populate("user");
    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }
    if (post.status !== 1) {
      return makeErrorResponse({
        res,
        message: "Not allowed to change this post status",
      });
    }
    if (!status || ![2, 3].includes(status)) {
      return makeErrorResponse({
        res,
        message: "Invalid post status",
      });
    }
    if (status == 3 && (!reason || !reason.trim())) {
      return makeErrorResponse({
        res,
        message: "Please provide reason when rejecting post",
      });
    }
    await post.updateOne({ status });
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
            ? "Bài đăng của bạn đã được xét duyệt thành công"
            : `Bài đăng của bạn đã bị từ chối!\nLý do: ${reason}`,
      });
    }
    return makeSuccessResponse({ res, message: "Post status changed" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    const { user } = req;
    const post = await Post.findById(id).populate("user");
    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }
    await post.deleteOne();
    if (!post.user._id.equals(user._id) && reason) {
      await Notification.create({
        user: post.user._id,
        data: {
          user: {
            _id: post.user._id,
          },
        },
        kind: 3,
        message: `Bài đăng của bạn đã bị gỡ bỏ\nLý do: ${reason}`,
      });
    }
    return makeSuccessResponse({
      res,
      message: "Delete user success",
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const getPost = async (req, res) => {
  try {
    const id = req.params.id;
    const currentUser = req.user;
    const post = await Post.findById(id).populate("user");
    if (!post) {
      return makeErrorResponse({ res, message: "Post not found" });
    }
    return makeSuccessResponse({
      res,
      data: await formatPostData(post, currentUser),
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const getPosts = async (req, res) => {
  try {
    const result = await getListPosts(req);
    return makeSuccessResponse({
      res,
      data: result,
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

export {
  createPost,
  updatePost,
  deletePost,
  getPost,
  getPosts,
  changeStatusPost,
};
