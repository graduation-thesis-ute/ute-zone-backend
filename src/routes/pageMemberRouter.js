import express from "express";
import auth from "../middlewares/authentication.js";
import {
  addPageMember,
  updatePageMemberRole,
  getPageMembers,
  removePageMember,
  getMemberOfPage,
} from "../controllers/pageMemberController.js";

const router = express.Router();

router.post("/add", auth("PAGE_MEMBER_C"), addPageMember);
router.put("/update-role", auth("PAGE_MEMBER_U"), updatePageMemberRole);
router.get("/list", auth("PAGE_MEMBER_L"), getPageMembers);
router.delete("/remove/:pageMemberId", auth("PAGE_MEMBER_D"), removePageMember);
router.get("/members/:id", auth("PAGE_MEMBER_LIST_OF_PAGE"), getMemberOfPage);
export { router as pageMemberRouter };
