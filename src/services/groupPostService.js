import GroupPost from "../models/groupPostModel.js";
import { isValidObjectId } from "./apiService.js";

const formatGroupPostData = (post) => {
  return {
    id: post._id,
    group: post.group,
    user: post.user,
    content: post.content,
    imageUrls: post.imageUrls,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

export const getListGroupPosts = async (req) => {
  try {
    const { groupId, userId, page = 1, limit = 10 } = req.query;
    const query = {};

    if (groupId) {
      if (!isValidObjectId(groupId)) {
        throw new Error("Invalid group id");
      }
      query.group = groupId;
    }

    if (userId) {
      if (!isValidObjectId(userId)) {
        throw new Error("Invalid user id");
      }
      query.user = userId;
    }

    const posts = await GroupPost.find(query)
      .populate("group", "name avatarUrl")
      .populate("user", "displayName avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GroupPost.countDocuments(query);

    return {
      posts: posts.map(formatGroupPostData),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw error;
  }
};

export const createGroupPost = async (groupId, userId, content, imageUrls = []) => {
  try {
    if (!isValidObjectId(groupId) || !isValidObjectId(userId)) {
      throw new Error("Invalid id");
    }

    // Check if user is a member of the group
    const groupMember = await GroupMember.findOne({ group: groupId, user: userId });
    if (!groupMember) {
      throw new Error("You must be a member of the group to post");
    }

    const post = await GroupPost.create({
      group: groupId,
      user: userId,
      content,
      imageUrls,
      status: 1,
    });

    return formatGroupPostData(post);
  } catch (error) {
    throw error;
  }
};

export const updateGroupPost = async (postId, userId, content, imageUrls) => {
  try {
    if (!isValidObjectId(postId)) {
      throw new Error("Invalid post id");
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Check if user is the post creator or group admin/owner
    const groupMember = await GroupMember.findOne({
      group: post.group,
      user: userId,
    });

    if (!post.user.equals(userId) && (!groupMember || ![1, 2].includes(groupMember.role))) {
      throw new Error("You don't have permission to update this post");
    }

    post.content = content;
    if (imageUrls) {
      post.imageUrls = imageUrls;
    }
    await post.save();

    return formatGroupPostData(post);
  } catch (error) {
    throw error;
  }
};

export const deleteGroupPost = async (postId, userId) => {
  try {
    if (!isValidObjectId(postId)) {
      throw new Error("Invalid post id");
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Check if user is the post creator or group admin/owner
    const groupMember = await GroupMember.findOne({
      group: post.group,
      user: userId,
    });

    if (!post.user.equals(userId) && (!groupMember || ![1, 2].includes(groupMember.role))) {
      throw new Error("You don't have permission to delete this post");
    }

    await GroupPost.findByIdAndDelete(postId);
    return true;
  } catch (error) {
    throw error;
  }
};

export const getGroupPosts = async (groupId, userId, page = 1, limit = 10) => {
  try {
    if (!isValidObjectId(groupId)) {
      throw new Error("Invalid group id");
    }

    // Check if user is a member of the group
    const groupMember = await GroupMember.findOne({ group: groupId, user: userId });
    if (!groupMember) {
      throw new Error("You must be a member of the group to view posts");
    }

    const posts = await GroupPost.find({ group: groupId })
      .populate("user", "displayName avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GroupPost.countDocuments({ group: groupId });

    return {
      posts: posts.map(formatGroupPostData),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw error;
  }
};

export const getGroupPost = async (postId, userId) => {
  try {
    if (!isValidObjectId(postId)) {
      throw new Error("Invalid post id");
    }

    const post = await GroupPost.findById(postId)
      .populate("user", "displayName avatarUrl");
    
    if (!post) {
      throw new Error("Post not found");
    }

    // Check if user is a member of the group
    const groupMember = await GroupMember.findOne({ group: post.group, user: userId });
    if (!groupMember) {
      throw new Error("You must be a member of the group to view posts");
    }

    return formatGroupPostData(post);
  } catch (error) {
    throw error;
  }
};

export const updatePostStatus = async (postId, status, userId) => {
  try {
    if (!isValidObjectId(postId)) {
      throw new Error("Invalid post id");
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Check if user is group admin/owner
    const groupMember = await GroupMember.findOne({
      group: post.group,
      user: userId,
    });

    if (!groupMember || ![1, 2].includes(groupMember.role)) {
      throw new Error("You don't have permission to update post status");
    }

    if (![2, 3].includes(status)) {
      throw new Error("Invalid status");
    }

    post.status = status;
    await post.save();

    return formatGroupPostData(post);
  } catch (error) {
    throw error;
  }
}; 