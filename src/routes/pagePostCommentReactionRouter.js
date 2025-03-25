import express from "express";
import auth from "../middlewares/authentication.js";
import {
  createPagePostCommentReaction,
  deletePagePostCommentReaction,
  getPagePostCommentReactions,
} from "../controllers/pagePostCommentReaction.js";

const router = express.Router();

router.post("/create", auth("PAGE_POST_COMMENT_REACTION_C"), createPagePostCommentReaction);
router.delete("/delete/:id", auth("PAGE_POST_COMMENT_REACTION_D"), deletePagePostCommentReaction);
router.get("/list", auth("PAGE_POST_COMMENT_REACTION_L"), getPagePostCommentReactions);

export { router as pagePostCommentReactionRouter };
