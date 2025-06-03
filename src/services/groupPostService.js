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

  // Kiểm tra quyền truy cập nhóm
  const group = await Group.findById(groupPost.group);
  if (!group) {
    throw new Error("Group not found");
  }

  // Nếu không phải thành viên và nhóm không công khai
  if (!groupMember && group.status !== 1) {
    throw new Error("You don't have permission to view posts in this group");
  }

  // Nếu không phải thành viên, chỉ cho phép xem bài đăng đã duyệt
  if (!groupMember && groupPost.status !== 2) {
    throw new Error("You don't have permission to view this post");
  }

  groupPost.isOwner = groupPost.user._id.equals(currentUser._id) ? 1 : 0;
  const comments = await GroupPostComment.find({ groupPost: groupPost._id });
  const reactions = await GroupPostReaction.find({ groupPost: groupPost._id });
  groupPost.totalComments = comments.length;
  groupPost.totalReactions = reactions.length;
  
  // Chỉ kiểm tra reaction nếu là thành viên
  groupPost.isReacted = groupMember ? (await GroupPostReaction.exists({
    user: currentUser._id,
    groupPost: groupPost._id,
  })) ? 1 : 0 : 0;

  return {
      id: groupPost._id,
      group:{
        _id: group._id, 
        name: group.name,
        avatarUrl: group.avatarUrl,
        status: group.status
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

        // Nếu không có groupId, lấy tất cả bài đăng từ các nhóm công khai
        if (!groupId) {
            // Lấy danh sách các nhóm công khai
            const publicGroups = await Group.find({ status: 1 }).select('_id');
            const publicGroupIds = publicGroups.map(group => group._id);
            
            // Lấy danh sách các nhóm mà user là thành viên
            const userGroups = await GroupMember.find({ 
                user: currentUser._id 
            }).select('group');
            const userGroupIds = userGroups.map(member => member.group);

            // Kết hợp cả hai danh sách để lấy tất cả nhóm có quyền xem
            const accessibleGroupIds = [...new Set([...publicGroupIds, ...userGroupIds])];
            
            query.group = { $in: accessibleGroupIds };
            
            // Nếu không phải thành viên của nhóm, chỉ hiển thị bài đăng đã duyệt
            query.status = 2;
        } else {
            if (!isValidObjectId(groupId)) {
                throw new Error("Invalid group id");
            }
            query.group = groupId;

            // Kiểm tra quyền truy cập nhóm
            const group = await Group.findById(groupId);
            if (!group) {
                throw new Error("Group not found");
            }

            // Kiểm tra xem user có phải là thành viên không
            const isMember = await GroupMember.exists({ 
                group: groupId, 
                user: currentUser._id 
            });

            // Nếu không phải thành viên và nhóm không công khai
            if (!isMember && group.status !== 1) {
                throw new Error("You don't have permission to view posts in this group");
            }

            // Nếu không phải thành viên, chỉ cho phép xem bài đăng đã duyệt
            if (!isMember) {
                query.status = 2; // Chỉ hiển thị bài đăng đã duyệt
            }
        }

        if (userId) {
            if (!isValidObjectId(userId)) {
                throw new Error("Invalid user id");
            }
            query.author = userId;
        }

        if (status && (query.status === undefined)) {
            query.status = status;
        }

        if (content) {
            query.content = { $regex: content, $options: "i" };
        }

        const sortCriteria = { createdAt: -1 };

        const [totalElements, groupPosts] = await Promise.all([
            GroupPost.countDocuments(query),
            GroupPost.find(query)
                .populate("group", "name avatarUrl status")  
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