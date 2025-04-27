import GroupJoinRequest from "../models/groupJoinRequestModel.js";
import { isValidObjectId } from "./apiService.js";

const formatJoinRequestData = (joinRequest) => {
  return {
    id: joinRequest._id,
    group: joinRequest.group,
    user: joinRequest.user,
    status: joinRequest.status,
    requestedAt: joinRequest.requestedAt,
    createdAt: joinRequest.createdAt,
    updatedAt: joinRequest.updatedAt,
  };
};

export const getListJoinRequests = async (req) => {
  try {
    const { groupId, userId, status, page = 1, limit = 10 } = req.query;
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

    if (status) {
      query.status = parseInt(status);
    }

    const joinRequests = await GroupJoinRequest.find(query)
      .populate("group", "name avatarUrl")
      .populate("user", "displayName avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GroupJoinRequest.countDocuments(query);

    return {
      joinRequests: joinRequests.map(formatJoinRequestData),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw error;
  }
}; 