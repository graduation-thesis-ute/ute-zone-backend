import PageFollower from "../models/pageFollowerModel.js";
import Page from "../models/pageModel.js";
import {
    makeErrorResponse,
    makeSuccessResponse,
} from "../services/apiService.js"
import { formatPageFollowerData, getListPageFollowers, getListPageFollowersOfCurrentUser } from "../services/pageFollowerService.js";

const toggleFollowPage = async (req, res) => {
    try {
      const { pageId } = req.body; // Lấy pageId từ URL
      const currentUser = req.user;
      // Kiểm tra xem trang có tồn tại không
      const page = await Page.findById(pageId);
      if (!page) {
        throw new Error("Page not found");
      }
  
      // Kiểm tra trạng thái follow hiện tại
      const existingFollower = await PageFollower.findOne({
        user: currentUser._id,
        page: pageId,
      });
  
      if (existingFollower) {
        // Nếu đã follow thì unfollow
        await existingFollower.deleteOne();
        return makeSuccessResponse({
          res,
          message: "Successfully unfollowed the page",
        });
      } else {
        // Nếu chưa follow thì follow
        const newFollower = new PageFollower({
          user: currentUser._id,
          page: pageId,
          followedAt: new Date(),
        });
        await newFollower.save();
        return makeSuccessResponse({
          res,
          message: "Successfully followed the page",
        });
      }
    } catch (error) {
      return makeErrorResponse({
        res,
        message: error.message,
      });
    }
  };

// Controller for getting list of page followers
const getPageFollowers = async (req, res) => {
  try {
    const result = await getListPageFollowers(req);
    if (result.content.length === 0) {
      return makeErrorResponse({
        res,
        message: "No valid page followers found",
      });
    }
    return makeSuccessResponse({
      res,
      data: result,
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const getPageFollowersOfCurrentUser = async (req, res) => {
    try {
        const currentUser = req.user;
        const result = await getListPageFollowersOfCurrentUser(req, currentUser._id);
        return makeSuccessResponse({res, data: result});
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

const getSuggestedPages = async (req, res) => {
    try {
        const currentUser = req.user;
        const { page = 0, size = 10 } = req.query;
        const offset = parseInt(page, 10) * parseInt(size, 10);
        const limit = parseInt(size, 10);

        // Lấy danh sách các trang mà user đã follow
        const followedPages = await PageFollower.find({ user: currentUser._id })
            .select('page')
            .lean();
        const followedPageIds = followedPages.map(fp => fp.page);

        // Lấy danh sách các trang gợi ý (chưa follow)
        const suggestedPages = await Page.find({
            _id: { $nin: followedPageIds },
            isDeleted: { $ne: true }
        })
        .select('name description avatarUrl totalFollowers category')
        .sort({ totalFollowers: -1 }) // Sắp xếp theo số người follow giảm dần
        .skip(offset)
        .limit(limit);

        // Lấy tổng số trang gợi ý
        const totalElements = await Page.countDocuments({
            _id: { $nin: followedPageIds },
            isDeleted: { $ne: true }
        });

        const totalPages = Math.ceil(totalElements / limit);

        return makeSuccessResponse({
            res,
            data: {
                content: suggestedPages,
                totalPages,
                totalElements
            }
        });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

export {
    toggleFollowPage,
    getPageFollowers,
    getPageFollowersOfCurrentUser,
    getSuggestedPages,
};