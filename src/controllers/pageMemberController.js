import PageMember from "../models/pageMemberModel.js";
import User from "../models/userModel.js";
import Page from "../models/pageModel.js";
import Notification from "../models/notificationModel.js";
import {
  isValidObjectId,
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import { formatPageMemberData, getListPageMembers, getListMemberOfPage } from "../services/pageMemberService.js";

// Add a user to a page with a role
const addPageMember = async (req, res) => {
  try {
    const { page, user, role } = req.body;
    if (!isValidObjectId(page) || !isValidObjectId(user)) {
      return makeErrorResponse({ res, message: "Invalid page or user ID" });
    }
    const existingUser = await User.findById(user);
    if (!existingUser) {
      return makeErrorResponse({ res, message: "User not found" });
    }
    const existingPage = await Page.findById(page);
    if (!existingPage) {
      return makeErrorResponse({ res, message: "Page not found" });
    }
    const existingPageMember = await PageMember.findOne({ page, user });
    if (existingPageMember) {
      return makeErrorResponse({ res, message: "User already a member" });
    }
    await PageMember.create({ page, user, role });
    await Notification.create({
      user,
      message: `You have been added to the page ${existingPage.name}`,
    });
    return makeSuccessResponse({ res, message: "User added successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Update user role in page
const updatePageMemberRole = async (req, res) => {
  try {
    const { pageMemberId, role } = req.body;
    const pageMember = await PageMember.findById(pageMemberId);
    if (!pageMember) {
      return makeErrorResponse({ res, message: "Page member not found" });
    }
    pageMember.role = role;
    await pageMember.save();
    return makeSuccessResponse({ res, message: "Role updated successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Get list of page members
const getPageMembers = async (req, res) => {
  try {
    const result = await getListPageMembers(req);
    return makeSuccessResponse({ res, data: result });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Remove a user from page members
const removePageMember = async (req, res) => {
  try {
    const { pageMemberId } = req.params;
    const pageMember = await PageMember.findById(pageMemberId);
    if (!pageMember) {
      return makeErrorResponse({ res, message: "Page member not found" });
    }
    if (pageMember.role === 1) {
      return makeErrorResponse({res, message: "Cannot remove the page owner"});
    }
    await pageMember.deleteOne();
    return makeSuccessResponse({ res, message: "User removed successfully" });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};
// Get list of members for a specific page
const getMemberOfPage = async (req, res) => {
  try {
    const id = req.params.id;
    const page = await Page.findById(id);
        if (!page){
            return makeErrorResponse({res, message: "Page not found"});
        }
    const result = await getListMemberOfPage(req, id);
    return makeSuccessResponse({ res, data: result });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

export { 
  addPageMember, 
  updatePageMemberRole, 
  getPageMembers, 
  removePageMember,
  getMemberOfPage,
};