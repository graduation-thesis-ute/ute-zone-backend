import express from "express";
import { 
  getModerationSetting,
  updateModerationSetting,
  getPageModerationSetting,
  updatePageModerationSetting,
  getGroupModerationSetting,
  updateGroupModerationSetting,
  getGlobalModerationSetting,
  updateGlobalModerationSetting,
  getModerationSettingsList
} from "../controllers/moderationSettingController.js";
import auth from "../middlewares/authentication.js";


const router = express.Router();

// Routes chung cho tất cả các loại entity
router.get("/", auth("MOD_SETTING"), getModerationSetting);
router.put("/", auth("MOD_SETTING"), updateModerationSetting);

// Routes cho page
router.get("/page/:pageId", auth("MOD_SETTING"), getPageModerationSetting);
router.put("/page/:pageId", auth("MOD_SETTING"), updatePageModerationSetting);

// Routes cho group
router.get("/group/:groupId", auth("MOD_SETTING"), getGroupModerationSetting);
router.put("/group/:groupId", auth("MOD_SETTING"), updateGroupModerationSetting);

// Routes cho cài đặt toàn cục (chỉ admin hệ thống)
router.get("/global", auth("MOD_SETTING"), getGlobalModerationSetting);
router.put("/global", auth("MOD_SETTING"), updateGlobalModerationSetting);

// Route mới để lấy danh sách cài đặt duyệt nội dung theo kind
router.get("/list", auth("MOD_SETTING"), getModerationSettingsList);

export { router as moderationSettingRouter };
