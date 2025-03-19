import Friendship from "../models/friendshipModel.js";
import Notification from "../models/notificationModel.js";
import PagePost from "../models/pagePostModel.js";
import {
  deleteFileByUrl,
  isValidUrl,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import { formatPagePostData, getListPagePosts } from "../services/pagePostService.js";

// Controller for creating a page post
const createPost = async (req, res) => {
  try {
    const { content, imageUrls, kind, pageId } = req.body;
    const errors = [];

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

    const validImageUrls =
      imageUrls?.map((url) => (isValidUrl(url) ? url : null)).filter(Boolean) ||
      [];
    
    const post = await PagePost.create({
      user: user._id,
      content,
      imageUrls: validImageUrls,
      page: pageId,
      status: 1, // Assuming default post status is "public"
      kind,
    });

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

    return makeSuccessResponse({ res, message: "Page post created successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Controller for fetching page posts
const getPosts = async (req, res) => {
  try {
    const { pageId } = req.params;
    const { page, size } = req.query;

    const result = await getListPagePosts(req);
    return makeSuccessResponse({ res, data: result });
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
      imageUrls: imageUrls
        ? imageUrls
            .map((imageUrl) => (isValidUrl(imageUrl) ? imageUrl : null))
            .filter((url) => url !== null)
        : [],
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

    if (status === 3 && (!reason || !reason.trim())) {
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
            ? "Your post has been approved successfully"
            : `Your post was rejected! Reason: ${reason}`,
      });
    }

    return makeSuccessResponse({ res, message: "Post status changed" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

export { createPost, getPosts, updatePost, deletePost, changeStatusPost };
