import express from "express";
import auth from "../middlewares/authentication.js";
import {
    addGroupMember,
    updateGroupMemberRole,
    getGroupMembers,
    removeGroupMember,
} from "../controllers/groupMemberController.js";

const router = express.Router();

router.post("/add", auth("GROUP_MEMBER_C"), addGroupMember);
router.put("/update-role", auth("GROUP_MEMBER_U"), updateGroupMemberRole);
router.get("/list", auth("GROUP_MEMBER_L"), getGroupMembers);
router.delete("/delete", auth("GROUP_MEMBER_D"), removeGroupMember);

export {router as groupMemberRouter};
