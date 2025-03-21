import mongoose from "mongoose";
import PagePostComment from "../models/pagePostCommentModel.js";
import PagePost from "../models/pagePostModel.js"; 
import { isValidObjectId } from "./apiService.js";
import { formatDistanceToNow } from "../configurations/schemaConfig.js";

const formatPagePostCommentData = async (comment, currentUser) => {
    comment.isOwner = comment.user._id.equals(currentUser._id) ? 1: 0;
    comment.isUpdated = comment.updatedAt.getTime() !== comment.createdAt.getTime() ? 1 : 0;
    // comment.isReacted = (await CommentReaction.exists({
    //   user: currentUser._id,
    //   comment: comment._id,
    // })) ? 1 : 0;
    comment.isChildren = comment.parent ? 1 : 0;
    comment.totalChildren = await PagePostComment.countDocuments({ parent: comment._id });
    //comment.totalReactions = reactions.length;
    return {
      _id: comment._id,
      post: {
        _id: comment.post,
      },
      user: {
        _id: comment.user._id,
        displayName: comment.user.displayName,
        avatarUrl: comment.user.avatarUrl,
      },
      content: comment.content,
      imageUrl: comment.imageUrl,
      createdAt: formatDistanceToNow(comment.createdAt),
      isOwner: comment.isOwner,
      isUpdated: comment.isUpdated,
      // isReacted: comment.isReacted,
      isChildren: comment.isChildren,
      ...(comment.isChildren === 1
        ? { parent: { _id: comment.parent } }
        : { totalChildren: comment.totalChildren }),
      //totalReactions: comment.totalReactions,
    };
  };
  const getPagePostListComments = async (req, pagePostId) => {
    const {
        pagePost,
        content,
        isPaged,
        parent,
        page = 0,
        ignoreChildren = "0",
        size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;
    const currentUser = req.user;
  
    const offset = parseInt(page, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);
  
    let query = {};
    if (pagePostId) {
        query.pagePost = pagePostId; // Không cần convert sang ObjectId vì findById đã xử lý
    }
    if (isValidObjectId(parent)) {
      query.parent = new mongoose.Types.ObjectId(parent);
    }
    if (ignoreChildren === "1") {
      query.parent = null;
    }
    if (content) {
      query.content = { $regex: content, $options: "i" };
    }
  
    const [totalElements, comments] = await Promise.all([
      PagePostComment.countDocuments(query),
      PagePostComment.find(query)
        .populate("user")
        .sort(ignoreChildren === "1" ? { createdAt: -1 } : { createdAt: 1 })
        .skip(offset)
        .limit(limit),
    ]);
  
    const totalPages = Math.ceil(totalElements / limit);
  
    const result = await Promise.all(
      comments.map(async (comment) => {
        return await formatPagePostCommentData(comment, currentUser);
      })
    );
  
    return {
      content: result,
      totalPages,
      totalElements,
    };
  };
  
  export { formatPagePostCommentData, getPagePostListComments };
  
