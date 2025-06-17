import ModerationSetting from "../models/moderationSettingModel.js";
import PageMember from "../models/pageMemberModel.js";
import GroupMember from "../models/groupMemberModel.js";
import Page from "../models/pageModel.js";
import Group from "../models/groupModel.js";
import {
  makeErrorResponse,
  makeSuccessResponse,
} from "../services/apiService.js";
import User from "../models/userModel.js";

// Kiểm tra quyền admin cho cài đặt toàn cục (Post)
const checkGlobalModerationPermission = async (user) => {
  if (user.isSuperAdmin !== 1) {
    throw new Error(
      "Only system admin can update global post moderation settings"
    );
  }
};

// Kiểm tra quyền admin cho page/group
const checkEntityModerationPermission = async (
  entityType,
  entityId,
  userId
) => {
  if (entityType === 2) {
    // PagePost
    const pageMember = await PageMember.findOne({
      page: entityId,
      user: userId,
      // role: 3 // Chỉ admin page mới được cập nhật
    });
    if (!pageMember) {
      throw new Error(
        "You do not have permission to update page moderation settings"
      );
    }
  } else if (entityType === 3) {
    // GroupPost
    // Kiểm tra xem user có phải là super admin không
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Nếu user là super admin thì cho phép luôn
    if (user.isSuperAdmin === 1) {
      return;
    }

    // Nếu không phải super admin, kiểm tra role trong group
    const groupMember = await GroupMember.findOne({
      group: entityId,
      user: userId,
      role: { $in: [1, 2] }, // Role là 1 (admin) hoặc 2 (moderator)
    });

    if (!groupMember) {
      throw new Error(
        "Bạn không có quyền cập nhật cài đặt duyệt tự động của nhóm. Chỉ admin và moderator của nhóm mới có quyền này."
      );
    }
  }
};

// Lấy cài đặt duyệt bài
const getModerationSetting = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    console.log(entityType, entityId);
    if (!entityType || ![1, 2, 3].includes(Number(entityType))) {
      return makeErrorResponse({ res, message: "Invalid entity type" });
    }

    // Nếu là global settings (entityType = 1), sử dụng "global" làm entityId
    const finalEntityId = Number(entityType) === 1 ? "global" : entityId;

    if (Number(entityType) !== 1 && !finalEntityId) {
      return makeErrorResponse({
        res,
        message: "entityId is required for page and group settings",
      });
    }

    const setting = await ModerationSetting.findOne({
      entityType: Number(entityType),
      entityId: finalEntityId,
    });

    if (!setting) {
      // Nếu chưa có cài đặt, tạo mặc định
      const defaultSetting = await ModerationSetting.create({
        entityType: Number(entityType),
        entityId: finalEntityId,
        isAutoModerationEnabled: false,
        isModerationRequired: true,
        updatedBy: req.user._id,
      });
      return makeSuccessResponse({ res, data: defaultSetting });
    }

    return makeSuccessResponse({ res, data: setting });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Cập nhật cài đặt duyệt bài
const updateModerationSetting = async (req, res) => {
  try {
    const {
      entityType,
      entityId,
      isAutoModerationEnabled,
      isModerationRequired,
    } = req.body;

    if (!entityType || ![1, 2, 3].includes(Number(entityType))) {
      return makeErrorResponse({ res, message: "Invalid entity type" });
    }

    // Kiểm tra quyền
    if (entityType === 1) {
      await checkGlobalModerationPermission(req.user);
    } else {
      await checkEntityModerationPermission(entityType, entityId, req.user._id);
    }

    const setting = await ModerationSetting.findOneAndUpdate(
      {
        entityType: Number(entityType),
        entityId: entityId || null,
      },
      {
        isAutoModerationEnabled,
        isModerationRequired,
        updatedBy: req.user._id,
      },
      { new: true, upsert: true }
    );

    return makeSuccessResponse({
      res,
      message: "Moderation settings updated successfully",
      data: setting,
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Lấy cài đặt duyệt bài cho page
const getPageModerationSetting = async (req, res) => {
  try {
    const { pageId } = req.params;
    req.query.entityType = 2;
    req.query.entityId = pageId;
    return getModerationSetting(req, res);
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Cập nhật cài đặt duyệt bài cho page
const updatePageModerationSetting = async (req, res) => {
  try {
    // const { pageId } = req.params;
    const { isAutoModerationEnabled, isModerationRequired, pageId } = req.body;

    await checkEntityModerationPermission(2, pageId, req.user._id);

    const setting = await ModerationSetting.findOneAndUpdate(
      {
        entityType: 2,
        entityId: pageId,
      },
      {
        isAutoModerationEnabled,
        isModerationRequired,
        updatedBy: req.user._id,
      },
      { new: true, upsert: true }
    );

    return makeSuccessResponse({
      res,
      message: "Page moderation settings updated successfully",
      data: setting,
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Lấy cài đặt duyệt bài cho group
const getGroupModerationSetting = async (req, res) => {
  try {
    const { groupId } = req.params;
    req.query.entityType = 3;
    req.query.entityId = groupId;
    return getModerationSetting(req, res);
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Cập nhật cài đặt duyệt bài cho group
const updateGroupModerationSetting = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { isAutoModerationEnabled, isModerationRequired } = req.body;

    await checkEntityModerationPermission(3, groupId, req.user._id);

    const setting = await ModerationSetting.findOneAndUpdate(
      {
        entityType: 3,
        entityId: groupId,
      },
      {
        isAutoModerationEnabled,
        isModerationRequired,
        updatedBy: req.user._id,
      },
      { new: true, upsert: true }
    );

    return makeSuccessResponse({
      res,
      message: "Group moderation settings updated successfully",
      data: setting,
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Lấy cài đặt duyệt bài toàn cục
const getGlobalModerationSetting = async (req, res) => {
  try {
    // Tìm cài đặt toàn cục với entityId là "global"
    const setting = await ModerationSetting.findOne({
      entityType: 1,
      entityId: "global",
    });

    if (!setting) {
      // Nếu chưa có cài đặt, tạo mặc định
      const defaultSetting = await ModerationSetting.create({
        entityType: 1,
        entityId: "global",
        isAutoModerationEnabled: false,
        isModerationRequired: true,
        updatedBy: req.user._id,
      });
      return makeSuccessResponse({ res, data: defaultSetting });
    }

    return makeSuccessResponse({ res, data: setting });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Cập nhật cài đặt duyệt bài toàn cục
const updateGlobalModerationSetting = async (req, res) => {
  try {
    const { isAutoModerationEnabled, isModerationRequired } = req.body;

    await checkGlobalModerationPermission(req.user);

    // Xóa tất cả các cài đặt toàn cục hiện tại
    await ModerationSetting.deleteMany({
      entityType: 1,
    });

    // Tạo cài đặt toàn cục mới
    const setting = await ModerationSetting.create({
      entityType: 1,
      entityId: "global", // Sử dụng "global" thay vì null
      isAutoModerationEnabled,
      isModerationRequired,
      updatedBy: req.user._id,
    });

    return makeSuccessResponse({
      res,
      message: "Thay đổi trạng thái kiểm duyệt thành công",
      data: setting,
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

// Hàm tạo cài đặt mặc định cho page mới
const createDefaultPageModerationSetting = async (pageId, userId) => {
  try {
    const setting = await ModerationSetting.create({
      entityType: 2,
      entityId: pageId,
      isAutoModerationEnabled: true, // Mặc định bật duyệt tự động bằng AI
      isModerationRequired: true,
      updatedBy: userId,
    });
    return setting;
  } catch (error) {
    console.error("Error creating default page moderation setting:", error);
    throw error;
  }
};

// Hàm tạo cài đặt mặc định cho group mới
const createDefaultGroupModerationSetting = async (groupId, userId) => {
  try {
    const setting = await ModerationSetting.create({
      entityType: 3,
      entityId: groupId,
      isAutoModerationEnabled: true, // Mặc định bật duyệt tự động bằng AI
      isModerationRequired: true,
      updatedBy: userId,
    });
    return setting;
  } catch (error) {
    console.error("Error creating default group moderation setting:", error);
    throw error;
  }
};

// Lấy danh sách cài đặt duyệt nội dung theo kind
const getModerationSettingsList = async (req, res) => {
  try {
    const { kind } = req.query;

    if (!kind || ![1, 2, 3].includes(Number(kind))) {
      return makeErrorResponse({
        res,
        message:
          "Invalid kind parameter. Must be 1 (global), 2 (page) or 3 (group)",
      });
    }

    const entityType = Number(kind);
    let query = { entityType };

    // Nếu là global settings (kind = 1), tìm cài đặt có entityId là null
    if (entityType === 1) {
      query.entityId = { $exists: false };
    }

    const settings = await ModerationSetting.find(query)
      .populate("updatedBy", "username fullName avatar")
      .sort({ updatedAt: -1 });

    // Xử lý đặc biệt cho page settings (kind = 2)
    if (entityType === 2) {
      // Lấy danh sách tất cả các page
      const pages = await Page.find({});

      // Tìm các page chưa có cài đặt duyệt bài
      const pageIds = pages.map((page) => page._id.toString());
      const existingPageIds = settings.map((setting) =>
        setting.entityId.toString()
      );
      const missingPageIds = pageIds.filter(
        (id) => !existingPageIds.includes(id)
      );

      // Tạo cài đặt mặc định cho các page chưa có
      if (missingPageIds.length > 0) {
        const newSettings = await Promise.all(
          missingPageIds.map((pageId) =>
            createDefaultPageModerationSetting(pageId, req.user._id)
          )
        );
        settings.push(...newSettings);
      }
    }
    // Xử lý đặc biệt cho group settings (kind = 3)
    else if (entityType === 3) {
      // Lấy danh sách tất cả các group
      const groups = await Group.find({});

      // Tìm các group chưa có cài đặt duyệt bài
      const groupIds = groups.map((group) => group._id.toString());
      const existingGroupIds = settings.map((setting) =>
        setting.entityId.toString()
      );
      const missingGroupIds = groupIds.filter(
        (id) => !existingGroupIds.includes(id)
      );

      // Tạo cài đặt mặc định cho các group chưa có
      if (missingGroupIds.length > 0) {
        const newSettings = await Promise.all(
          missingGroupIds.map((groupId) =>
            createDefaultGroupModerationSetting(groupId, req.user._id)
          )
        );
        settings.push(...newSettings);
      }
    }

    // Nếu chưa có cài đặt nào và là global, tạo mặc định
    if (settings.length === 0 && entityType === 1) {
      const defaultSetting = await ModerationSetting.create({
        entityType: 1,
        isAutoModerationEnabled: false,
        isModerationRequired: true,
        updatedBy: req.user._id,
      });
      return makeSuccessResponse({
        res,
        data: [defaultSetting],
      });
    }

    return makeSuccessResponse({
      res,
      data: settings.sort((a, b) => b.updatedAt - a.updatedAt), // Sắp xếp lại theo thời gian cập nhật
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

export {
  getModerationSetting,
  updateModerationSetting,
  getPageModerationSetting,
  updatePageModerationSetting,
  getGroupModerationSetting,
  updateGroupModerationSetting,
  getGlobalModerationSetting,
  updateGlobalModerationSetting,
  getModerationSettingsList,
  createDefaultPageModerationSetting,
  createDefaultGroupModerationSetting,
};
