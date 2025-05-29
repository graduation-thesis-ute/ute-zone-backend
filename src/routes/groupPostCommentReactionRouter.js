import express from "express";
import auth from "../middlewares/authentication.js";
import { createGroupPostCommentReaction, deleteGroupPostCommentReaction, getGroupPostCommentReactions } from "../controllers/groupPostCommentReactionController.js";

const router = express.Router();

router.post("/create", auth("GROUP_POST_COMMENT_REACTION"), createGroupPostCommentReaction);
router.delete("/delete/:id", auth("GROUP_POST_COMMENT_REACTION"), deleteGroupPostCommentReaction);
router.get("/list", auth("GROUP_POST_COMMENT_REACTION"), getGroupPostCommentReactions);

export { router as groupPostCommentReactionRouter };
