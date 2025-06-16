import { formatGroupData, getListGroups } from "../services/groupService.js";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { createDefaultGroupModerationSetting } from "./moderationSettingController.js";
import {
  deleteFileByUrl,
  isValidObjectId,
  isValidUrl,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";

const createGroup = async (req, res) => {
  try {
    const { name, description, avatarUrl, coverUrl, privacy} = req.body;
    const currentUser = req.user;
    const errors = [];
    if (!name || !name.trim()) {
      errors.push({ field: "name", message: "name cannot be null" });
    }
    if (!privacy || ![1,2].includes(privacy)) {
      errors.push({ field: "privacy", message: "privacy must be public or private" });
    }
    if (errors.length > 0) {
      return makeErrorResponse({res, message: "Invalid form", data: errors});
    }
    const group = await Group.create({
      name,
      description,
      avatarUrl: isValidUrl(avatarUrl) ? avatarUrl : null,
      coverUrl: isValidUrl(coverUrl) ? coverUrl : null,
      privacy,
      owner: currentUser._id,
      status: 2,
    });

    // Create group member (owner)
    await GroupMember.create({
      group: group._id,
      user: currentUser._id,
      role: 1,
    });

    // Tự động tạo cài đặt duyệt bài cho group mới
    await createDefaultGroupModerationSetting(group._id, currentUser._id);

    return makeSuccessResponse({res, message: "Group created successfully", data: group});
  } catch (error) {
    return makeErrorResponse({res, message: error.message});
  }
};

const updateGroup = async (req, res) => {
  try {
    const { id, name, description, avatarUrl, coverUrl, privacy } = req.body;
    const currentUser = req.user;
    if (!isValidObjectId(id)) {
      return makeErrorResponse({res, message: "Invalid id"});
    }
    const group = await Group.findById(id);
    if (!group) {
      return makeErrorResponse({res, message: "Group not found"});
    }
    const groupMember = await GroupMember.findOne({group: id, user: currentUser._id});
    if (!group.owner.equals(currentUser._id) || !groupMember.role === 1) {
      return makeErrorResponse({res, message: "You are not the owner of this group"});
    }
    if (group.avatarUrl !== avatarUrl) {
      await deleteFileByUrl(group.avatarUrl);
    }
    if (group.coverUrl !== coverUrl) {
      await deleteFileByUrl(group.coverUrl);
    }
    await group.updateOne({
      name,
      description,
      avatarUrl: isValidUrl(avatarUrl) ? avatarUrl : null,
      coverUrl: isValidUrl(coverUrl) ? coverUrl : null,
      privacy,
    });

    return makeSuccessResponse({res, message: "Group updated successfully", data: group});
  } catch (error) {
    return makeErrorResponse({res, message: error.message});
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    if (!isValidObjectId(id)) {
      return makeErrorResponse({res, message: "Invalid id"});
    }
    const group = await Group.findById(id);
    if (!group) {
      return makeErrorResponse({res, message: "Group not found"});
    }
    if (!group.owner.equals(currentUser._id)) {
      return makeErrorResponse({res, message: "You are not the owner of this group"});
    }
    await group.updateOne({ status: 1 });
    return makeSuccessResponse({res, message: "Group status updated successfully"});
  } catch (error) {
    return makeErrorResponse({res, message: error.message});
  }
};
const changeStatusGroup = async (req, res) => {
  try {
    const { id, status, reason } = req.body;
    const { user } = req;
    const group = await Group.findById(id).populate("owner");
    if (!group) {
      return makeErrorResponse({res, message: "Group not found"});
    }
    if (!status || ![1, 2, 3].includes(status)) {
      return makeErrorResponse({res, message: "Invalid group status"});
    }
    if (status === 3 && (!reason || !reason.trim())) {
      return makeErrorResponse({res, message: "Please provide reason when rejecting group"});
    }   
    await group.updateOne({status});
    return makeSuccessResponse({res, message: "Group status updated successfully"});
  } catch (error) {
    return makeErrorResponse({res, message: error.message});
  }
};


const getGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    if (!isValidObjectId(id)) {
      return makeErrorResponse({res, message: "Invalid id"});
    }
    const group = await Group.findById(id);
    if (!group) {
      return makeErrorResponse({res, message: "Group not found"});
    }
    return makeSuccessResponse({
      res,
      data: await formatGroupData(group, currentUser),
    });
  } catch (error) {
    return makeErrorResponse({res, message: error.message});
  }
};  

const getGroups = async (req, res) => {
  try {
    const result = await getListGroups(req);
    return makeSuccessResponse({res, message: "Groups fetched successfully", data: result});
  } catch (error) {
    return makeErrorResponse({res, message: error.message});
  }
};

export {
  createGroup,
  updateGroup,
  deleteGroup,  
  changeStatusGroup,
  getGroup,
  getGroups,
};