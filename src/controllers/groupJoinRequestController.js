import GroupJoinRequest from "../models/groupJoinRequestModel.js";
import { isValidObjectId, makeErrorResponse, makeSuccessResponse } from "../services/apiService.js";
import { getListJoinRequests } from "../services/groupJoinRequestService.js";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import Notification from "../models/notificationModel.js";

// Send join request
const sendJoinRequest = async (req, res) => {
    try {
        const { groupId } = req.body;
        const userId = req.user._id;

        if (!isValidObjectId(groupId)) {
            return makeErrorResponse({ res, message: "Invalid group ID" });
        }

        // Check if group exists
        const group = await Group.findById(groupId);
        if (!group) {
            return makeErrorResponse({ res, message: "Group not found" });
        }

        // Check if user is already a member
        const existingMember = await GroupMember.findOne({ group: groupId, user: userId });
        if (existingMember) {
            return makeErrorResponse({ res, message: "You are already a member of this group" });
        }

        // Check if request already exists
        const existingRequest = await GroupJoinRequest.findOne({ 
            group: groupId, 
            user: userId,
            status: { $in: [0, 1] } // Pending or Accepted
        });
        if (existingRequest) {
            return makeErrorResponse({ res, message: "Join request already exists" });
        }

        // If group is public (privacy = 1), directly add user as member
        if (group.privacy === 1) {
            const newMember = await GroupMember.create({
                group: groupId,
                user: userId,
                role: 2, // Regular member
                status: 1 // Active
            });

            return makeSuccessResponse({ 
                res, 
                message: "Joined group successfully",
                data: newMember
            });
        }

        // If group is private (privacy = 2), create join request
        const joinRequest = await GroupJoinRequest.create({
            group: groupId,
            user: userId,
            status: 1, // Pending
            requestedAt: new Date()
        });

        // Notify group admins
        const groupAdmins = await GroupMember.find({ 
            group: groupId, 
            role: { $in: [1, 2] } // Owner and Admins
        });
        
        for (const admin of groupAdmins) {
            await Notification.create({
                user: admin.user,
                type: 'GROUP_JOIN_REQUEST',
                message: `${req.user.displayName} đã yêu cầu tham gia nhóm ${group.name}`,
                reference: {
                    type: 'GROUP_JOIN_REQUEST',
                    id: joinRequest._id
                }
            });
        }

        return makeSuccessResponse({ 
            res, 
            message: "Join request sent successfully",
            data: joinRequest
        });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

// Accept join request
const acceptJoinRequest = async (req, res) => {
    try {
        const { requestId } = req.body;
        console.log(requestId);
        if (!isValidObjectId(requestId)) {
            return makeErrorResponse({ res, message: "Invalid request ID" });
        }

        const joinRequest = await GroupJoinRequest.findById(requestId)
            .populate('group')
            .populate('user');
            
        if (!joinRequest) {
            return makeErrorResponse({ res, message: "Join request not found" });
        }

        if (joinRequest.status !== 1) {
            return makeErrorResponse({ res, message: "Join request is not pending" });
        }

        // Update request status
        joinRequest.status = 0; // Accepted
        await joinRequest.save();

        // Add user to group members
        await GroupMember.create({
            group: joinRequest.group._id,
            user: joinRequest.user._id,
            role: 2, // Regular member
            status: 1 // Active
        });

        // Notify user
        await Notification.create({
            user: joinRequest.user._id,
            type: 'GROUP_JOIN_ACCEPTED',
            message: `Yêu cầu tham gia nhóm ${joinRequest.group.name} của bạn đã được chấp nhận`,
            reference: {
                type: 'GROUP',
                id: joinRequest.group._id
            }
        });

        return makeSuccessResponse({ 
            res, 
            message: "Join request accepted successfully" 
        });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

// Reject join request
const rejectJoinRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        if (!isValidObjectId(requestId)) {
            return makeErrorResponse({ res, message: "Invalid request ID" });
        }

        const joinRequest = await GroupJoinRequest.findById(requestId)
            .populate('group')
            .populate('user');
            
        if (!joinRequest) {
            return makeErrorResponse({ res, message: "Join request not found" });
        }

        if (joinRequest.status !== 0) {
            return makeErrorResponse({ res, message: "Join request is not pending" });
        }

        // Update request status
        joinRequest.status = 2; // Rejected
        await joinRequest.save();

        // Notify user
        await Notification.create({
            user: joinRequest.user._id,
            type: 'GROUP_JOIN_REJECTED',
            message: `Yêu cầu tham gia nhóm ${joinRequest.group.name} của bạn đã bị từ chối`,
            reference: {
                type: 'GROUP',
                id: joinRequest.group._id
            }
        });

        return makeSuccessResponse({ 
            res, 
            message: "Join request rejected successfully" 
        });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

// Get list of join requests
const getJoinRequests = async (req, res) => {
    try {
        const result = await getListJoinRequests(req);
        return makeSuccessResponse({ res, data: result });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

// Delete join request
const deleteJoinRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        if (!isValidObjectId(requestId)) {
            return makeErrorResponse({ res, message: "Invalid request ID" });
        }

        const joinRequest = await GroupJoinRequest.findById(requestId);
        if (!joinRequest) {
            return makeErrorResponse({ res, message: "Join request not found" });
        }

        await joinRequest.deleteOne();

        return makeSuccessResponse({ 
            res, 
            message: "Join request deleted successfully" 
        });
    } catch (error) {
        return makeErrorResponse({ res, message: error.message });
    }
};

export {
    sendJoinRequest,
    acceptJoinRequest,
    rejectJoinRequest,
    getJoinRequests,
    deleteJoinRequest
};
