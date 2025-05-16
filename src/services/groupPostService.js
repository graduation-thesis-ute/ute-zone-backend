import mongoose from "mongoose";
import GroupMember from "../models/groupMemberModel.js";
import GroupPost from "../models/groupPostModel.js";
import Group from "../models/groupModel.js";
import { isValidObjectId } from "mongoose";
import GroupPostComment from "../models/groupPostCommentModel.js";
import GroupPostReaction from "../models/groupPostReactionModel.js";
const formatGroupPostData = async (groupPost, currentUser) => {
  const groupMember = await GroupMember.findOne({
    group: groupPost.group,
    user: currentUser._id,
  });
  if (!groupMember) {
    throw new Error("You are not a member of this group");
  }
  groupPost.isOwner = groupPost.user._id.equals(currentUser._id) ? 1 : 0;
  const group = await Group.findById(groupPost.group);
  const comments = await GroupPostComment.find({ groupPost: groupPost._id });
  const reactions = await GroupPostReaction.find({ groupPost: groupPost._id });
  groupPost.totalComments = comments.length;
  groupPost.totalReactions = reactions.length;
  groupPost.isReacted = (await GroupPostReaction.exists({
    user: currentUser._id,
    groupPost: groupPost._id,
  }))? 1 : 0;
  return {
      id: groupPost._id,
      group:{
        _id: group._id, 
        name: group.name,
        avatarUrl: group.avatarUrl,
      },
      user: {
        _id: groupPost.user._id,
        displayName: groupPost.user.displayName,
        avatarUrl: groupPost.user.avatarUrl,
      },
      content: groupPost.content,
      imageUrls: groupPost.imageUrls,
      status: groupPost.status,
      isOwner: groupPost.isOwner,
      totalComments: groupPost.totalComments,
      totalReactions: groupPost.totalReactions,
      isReacted: groupPost.isReacted,
      createdAt: groupPost.createdAt,
      updatedAt: groupPost.updatedAt
  };
};

const getListGroupPosts = async (req) => {
    try {
        const { 
          groupId,
          userId,
          content,
          status,
          isPaged,
          page = 0,
          size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
        } = req.query;
        const currentUser = req.user;
        const offset = parseInt(page, 10) * parseInt(size, 10);
        const limit = parseInt(size, 10);

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
            query.author = userId;
        }

       if (status) {
        query.status = status;
       }

       if (content) {
        query.content = { $regex: content, $options: "i" };
       }

       const sortCriteria = { createdAt: -1 };

       const [totalElements, groupPosts] = await Promise.all([
        GroupPost.countDocuments(query),
        GroupPost.find(query)
        .populate("group", "name avatarUrl")  
        .populate("user", "displayName avatarUrl")
        .sort(sortCriteria)
        .skip(offset)
        .limit(limit),
       ]);
       
       const totalPages = Math.ceil(totalElements / limit);

       const result = await Promise.all(
        groupPosts.map(async (post) => {
            return await formatGroupPostData(post, currentUser);
        })
       ); 

       return {
        content: result,
        totalPages,
        totalElements,
       };
    } catch (error) {
        throw error;
    }
}; 

export { formatGroupPostData, getListGroupPosts };