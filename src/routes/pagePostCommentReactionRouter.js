import express from "express";
import auth from "../middlewares/authentication.js";
import {
  createPagePostCommentReaction,
  deletePagePostCommentReaction,
  getPagePostCommentReactions,
} from "../controllers/pagePostCommentReactionController.js";

const router = express.Router();

router.post("/create", auth("PAGE_POST_COMMENT_REACTION"), createPagePostCommentReaction);
router.delete("/delete/:id", auth("PAGE_POST_COMMENT_REACTION"), deletePagePostCommentReaction);
router.get("/list", auth("PAGE_POST_COMMENT_REACTION"), getPagePostCommentReactions);

export { router as pagePostCommentReactionRouter };
