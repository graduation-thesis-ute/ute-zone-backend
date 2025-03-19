import PageFollower from "../models/pageFollowerModel.js";
import Page from "../models/pageModel.js";
import {
    makeErrorResponse,
    makeSuccessResponse,
} from "../services/apiService.js"
import { formatPageFollowerData, getListPageFollowers } from "../services/pageFollowerService.js";
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
    const id = req.params.id;
    const currentUser = req.user;
    const page = await Page.findById(id);
    if (!page){
        return makeErrorResponse({res, message: "Page not found"});
    }
    const result = await getListPageFollowers(req, id);
    return makeSuccessResponse({
    res,
    data: result,
    });
} catch (error) {
    return makeErrorResponse({ res, message: error.message });
}
};

export {
    toggleFollowPage,
    getPageFollowers,
};