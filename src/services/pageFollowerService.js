import mongoose from "mongoose";
import PageFollower from "../models/pageFollowerModel.js";

// Format page follower data to return required fields
const formatPageFollowerData = (pageFollower) => {
  return {
    _id: pageFollower._id,
    user: pageFollower.user
      ? {
          _id: pageFollower.user._id,
          displayName: pageFollower.user.displayName,
          avatarUrl: pageFollower.user.avatarUrl,
        }
      : null,
    page: pageFollower.page
      ? {
          _id: pageFollower.page._id,
          name: pageFollower.page.name,
          avatarUrl: pageFollower.page.avatarUrl,
        }
      : null,
    createdAt: pageFollower.createdAt,
  };
};

// Get list of page followers with pagination and filtering
const getListPageFollowersOfCurrentUser = async (req, pageId) => {
  const { page, size = 10 } = req.query;
  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);

  let query = {};
  
  // Lọc theo pageId nếu được cung cấp
  if (pageId) {
      query.page = pageId; // Không cần convert sang ObjectId vì findById đã xử lý
  }

  const [totalElements, pageFollowers] = await Promise.all([
      PageFollower.countDocuments(query),
      PageFollower.find(query)
          .populate('user') // Liên kết với bảng user để lấy thông tin người dùng
          .populate('page') // Liên kết với bảng page để lấy thông tin trang (nếu cần)
          .skip(offset)
          .limit(limit),
  ]);

  const totalPages = Math.ceil(totalElements / limit);

  // Lọc dữ liệu của các page follower theo định dạng cần thiết
  const result = pageFollowers.map(formatPageFollowerData);

  return {
      content: result,
      totalPages,
      totalElements,
  };
};
// Get list of page followers with pagination and filtering
const getListPageFollowers = async (req) => {
  const {
    page,
    isPaged,
    user,
    pageNumber = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER: 10,
  } = req.query;
  const offset = parseInt(pageNumber, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);
  console.log(offset, limit);
  let query = {};
  
  // Lọc theo pageId nếu được cung cấp
  if (mongoose.isValidObjectId(page)){
    query.page = new mongoose.Types.ObjectId(page);
  }
  if (mongoose.isValidObjectId(user)){
    query.user = new mongoose.Types.ObjectId(user);
  }
  
  const [totalElements, pageFollowers] = await Promise.all([
      PageFollower.countDocuments(query),
      PageFollower.find(query)
          .populate('user') // Liên kết với bảng user để lấy thông tin người dùng
          .populate('page') // Liên kết với bảng page để lấy thông tin trang (nếu cần)
          .skip(offset)
          .limit(limit),
  ]);

  const totalPages = Math.ceil(totalElements / limit);
  console.log("pageFollowers", pageFollowers);
  // Lọc dữ liệu của các page follower theo định dạng cần thiết
  const result = pageFollowers.map(formatPageFollowerData);
  console.log("result", result);
  return {
      content: result,
      totalPages,
      totalElements,
  };
};

const getPageFollowers = async (req) => {
  const {
    page,
    isPaged,
    pageNumber = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;
  
  const offset = parseInt(pageNumber, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);
  
  let query = {};
  
  if (mongoose.isValidObjectId(page)) {
    query.page = new mongoose.Types.ObjectId(page);
  }
  
  const [totalElements, pageFollowers] = await Promise.all([
    PageFollower.countDocuments(query),
    PageFollower.find(query)
      .populate('user')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
  ]);

  const totalPages = Math.ceil(totalElements / limit);

  const result = pageFollowers.map(formatPageFollowerData);

  return {
    content: result,
    totalPages,
    totalElements,
  };
};

export {formatPageFollowerData, getListPageFollowers, getListPageFollowersOfCurrentUser, getPageFollowers};
