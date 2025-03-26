import GroupMember from "../models/groupMemberModel.js";
import User from "../models/userModel.js";
import Group from "../models/groupModel.js";
import Notification from "../models/notificationModel.js";
import {
    isValidObjectId,
    makeErrorResponse,
    makeSuccessResponse,
} from "../services/apiService.js";
import {formatGroupMemberData, getListGroupMembers} from "../services/groupMemberService.js";

const addGroupMember = async (req, res) => {
    try {
        const {group, user, role} = req.body;
        if (!isValidObjectId(group) || !isValidObjectId(user)) {
            return makeErrorResponse({res, message: "Invalid group or user ID"});
        }
        const existingUser = await User.findById(user);
        if (!existingUser) {
            return makeErrorResponse({res, message: "User not found"});
        }
        const existingGroup = await Group.findById(group);
        if (!existingGroup) {
            return makeErrorResponse({res, message: "Group not found"});
        }
        const existingGroupMember = await GroupMember.findOne({group, user});
        if (existingGroupMember) {
            return makeErrorResponse({res, message: "User already a member of this group"});
        }
        await GroupMember.create({group, user, role});
        await Notification.create({
            user,
            message: `You have been added to the group ${existingGroup.name}`,
        });
        return makeSuccessResponse({res, message: "User added to group successfully"});
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
};

const updateGroupMemberRole = async (req, res) => {
    try {
        const {groupMemberId, role} = req.body;
        const groupMember = await GroupMember.findById(groupMemberId);
        if (!groupMember) {
            return makeErrorResponse({res, message: "Group member not found"});
        }
        groupMember.role = role;
        await groupMember.save();
        return makeSuccessResponse({res, message: "Role updated successfully"});
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
};


const getGroupMembers = async (req, res) => {
    try {
        const result = await getListGroupMembers(req);
        return makeSuccessResponse({res, data: result});
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
};

const removeGroupMember = async (req, res) => {
    try {
        const {groupMemberId} = req.params;
        const groupMember = await GroupMember.findById(groupMemberId);
        if (!groupMember) {
            return makeErrorResponse({res, message: "Group member not found"});
        }
        if (groupMember.role === 1) {
            return makeErrorResponse({res, message: "Cannot remove the group owner"});
        }
        await groupMember.deleteOne();
        return makeSuccessResponse({res, message: "User removed successfully"});
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
};
const changeGroupOwner = async (req, res) => {
    try {
        const {groupMemberId} = req.params;
        const {newOwnerId} = req.body;
        const groupMember = await GroupMember.findById(groupMemberId);
        if (!groupMember) {
            return makeErrorResponse({res, message: "Group member not found"});
        }
        groupMember.role = 1;
        await groupMember.save();
        return makeSuccessResponse({res, message: "Group owner changed successfully"});
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
};  
const changeStatusGroupMember = async (req, res) => {
    try {
        const {groupMemberId} = req.params;
        const {status} = req.body;
        const groupMember = await GroupMember.findById(groupMemberId);
        if (!groupMember) {
            return makeErrorResponse({res, message: "Group member not found"});
        }
        groupMember.status = status;
        await groupMember.save();
        return makeSuccessResponse({res, message: "Group member status changed successfully"});
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
};  
export {
    addGroupMember,
    updateGroupMemberRole,
    getGroupMembers,
    removeGroupMember,
    changeGroupOwner,
    changeStatusGroupMember,
};
        



