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
        const pageSize = 10;

        // Use aggregation to get suggested pages
        const suggestedPages = await Page.aggregate([
            // Match active community pages
            {
                $match: {
                    status: 1,
                    kind: 1
                }
            },
            // Lookup to check if user is following
            {
                $lookup: {
                    from: 'pagefollowers',
                    let: { pageId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$page', '$$pageId'] },
                                        { $eq: ['$user', currentUser._id] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'isFollowing'
                }
            },
            // Lookup to check if user is owner
            {
                $lookup: {
                    from: 'pages',
                    let: { pageId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$_id', '$$pageId'] },
                                        { $eq: ['$user', currentUser._id] },
                                        { $eq: ['$isOwner', 1] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'isOwner'
                }
            },
            // Only include pages that user is not following and not owner
            {
                $match: {
                    $and: [
                        { isFollowing: { $size: 0 } }, // Not following
                        { isOwner: { $size: 0 } }      // Not owner
                    ]
                }
            },
            // Project only needed fields
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    avatarUrl: 1,
                    coverUrl: 1,
                    category: 1,
                    totalFollowers: 1
                }
            },
            // Sort by total followers
            {
                $sort: { totalFollowers: -1 }
            },
            // Get total count
            {
                $facet: {
                    metadata: [{ $count: 'total' }],
                    data: [{ $limit: pageSize }]
                }
            }
        ]);

        const totalElements = suggestedPages[0].metadata[0]?.total || 0;
        const totalPages = Math.ceil(totalElements / pageSize);

        return makeSuccessResponse({
            res,
            data: {
                content: suggestedPages[0].data,
                totalElements,
                totalPages,
                size: pageSize,
                number: 0
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