import mongoose from "mongoose";
import GroupMember from "../models/groupMemberModel.js";
import User from "../models/userModel.js";
import { formatDistanceToNow } from "../configurations/schemaConfig.js";
import Group from "../models/groupModel.js";
import { isValidObjectId } from "./apiService.js";
const formatGroupMemberData = (groupMember) => {
    return {
        _id: groupMember._id,
        user: {
            _id: groupMember.user._id,
            displayName: groupMember.user.displayName,
            avatarUrl: groupMember.user.avatarUrl,
        },
        group: {
            _id: groupMember.group._id, 
        },
        role: groupMember.role,
        status: groupMember.status,
        createdAt: formatDistanceToNow(groupMember.createdAt),
    };
};

const getListGroupMembers = async (req) => {
    const {
        group,
        isPaged,
        pageNumber = 0,
        size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;

    const offset = parseInt(pageNumber, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);

    let query = {};
    if (mongoose.isValidObjectId(group)){
        query.group = new mongoose.Types.ObjectId(group);
    }

    const [totalElements, groupMembers] = await Promise.all([
        GroupMember.countDocuments(query),
        GroupMember.find(query).populate("user group").sort({createdAt: 1}).skip(offset).limit(limit),
    ]);
    const totalPages = Math.ceil(totalElements/limit);
    const result = groupMembers.map((groupMember) => {
        return formatGroupMemberData(groupMember);
    });

    return {
        content: result,
        totalPages,
        totalElements,
    };
};

export {formatGroupMemberData, getListGroupMembers};


