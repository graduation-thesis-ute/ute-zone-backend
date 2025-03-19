import mongoose from "mongoose";
import PagePost from "../models/pagePostModel.js";
import { formatDistanceToNow } from "../configurations/schemaConfig.js";
import Comment from "../models/commentModel.js";
import PostReaction from "../models/postReactionModel.js";

const formatPagePostData = async (pagePost, currentUser) => {
    // Tìm thông tin thành viên của trang (PageMember) với userId và pageId
    const pageMember = await PageMember.findOne({
    page: pagePost.page,
    user: pagePost.user,
    }).populate('user');  // Dùng populate để lấy thông tin user ngay từ PageMember

    if (!pageMember) {
    throw new Error("User is not a member of this page");
    }

    // Lấy thông tin người dùng từ bảng User thông qua pageMember
    const user = pageMember.user; // Vì đã populate, user thông tin đã có trong pageMember

    // Kiểm tra quyền sở hữu bài viết
    pagePost.isOwner = pagePost.user._id.equals(currentUser._id) ? 1 : 0;

    return {
        _id: pagePost._id,
        user: {
            _id: user._id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            role: {
            systemRole: {
                _id: user.role._id, // Role của người dùng trong hệ thống (User)
                name: user.role.name,
                kind: user.role.kind,
            },
            pageRole: {
                _id: pageMember.role, // Role của người dùng trong trang (PageMember)
                name: pageMember.role === 1 ? "Owner" : pageMember.role === 2 ? "Admin" : "Editor", // Chuyển đổi số thành tên
            },
            },
        },
        content: pagePost.content, // Thêm các thông tin bạn cần hiển thị
        imageUrls: pagePost.imageUrls,
        createdAt: pagePost.createdAt, // Thêm thông tin ngày tạo
        isOwner: pagePost.isOwner,
        isUpdated: pagePost.isUpdated,
    };
};

// Get list of page posts with filters and pagination
const getListPagePosts = async (req) => {
    const {
      content,
      status,
      user,
      kind,
      isPaged,
      page = 0,
      size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;
    const currentUser = req.user;
  
    const offset = parseInt(page, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);
  
    // Start building the query for posts
    let postQuery = {};
  
    // Filter by kind
    if (kind) {
      postQuery.kind = Number(kind); // 1: public, 2: follower, 3: only page member
    }
  
    // Filter by status (1: pending, 2: accepted, 3: rejected)
    if (status) {
      postQuery.status = Number(status);
    }
  
    // Filter by content (search)
    if (content) {
      postQuery.content = { $regex: content, $options: "i" };
    }
  
    // Filter by user if provided
    if (mongoose.isValidObjectId(user)) {
      postQuery.user = new mongoose.Types.ObjectId(user);
    }
  
    // Handle `kind` filtering
    if (kind === "2") {
      // Follower posts: Only show posts for users who follow the page
      // Assuming you have a `PageFollower` model that keeps track of followers
      const followers = await PageFollower.find({ page: postQuery.page }).select("user");
      const followerIds = followers.map(f => f.user);
      postQuery.user = { $in: followerIds };
    } else if (kind === "3") {
      // Page member posts: Only show posts for users who are members of the page
      const pageMembers = await PageMember.find({ page: postQuery.page }).select("user");
      const pageMemberIds = pageMembers.map(pm => pm.user);
      postQuery.user = { $in: pageMemberIds };
    }
  
    // Sort the posts
    const sortCriteria = { createdAt: -1 }; // Default sort by creation date
  
    // Get total number of posts and the posts themselves
    const [totalElements, posts] = await Promise.all([
      PagePost.countDocuments(postQuery),
      PagePost.find(postQuery)
        .populate({
          path: "user",
          populate: {
            path: "role",
          },
        })
        .sort(sortCriteria)
        .skip(offset)
        .limit(limit),
    ]);
  
    const totalPages = Math.ceil(totalElements / limit);
  
    // Format posts data
    const result = await Promise.all(
      posts.map(async (post) => {
        return await formatPagePostData(post, currentUser);
      })
    );
  
    return {
      content: result,
      totalPages,
      totalElements,
    };
  };
  

export { formatPagePostData, getListPagePosts };