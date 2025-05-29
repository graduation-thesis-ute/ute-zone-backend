import express from "express";
import auth from "../middlewares/authentication.js";
import {
  createGroupPostReaction,
  deleteGroupPostReaction,
  getGroupPostReactions,
} from "../controllers/groupPostReactionController.js";

const router = express.Router();

router.post("/create", auth("GROUP_POST_R"), createGroupPostReaction);
router.delete("/delete/:id", auth("GROUP_POST_R"), deleteGroupPostReaction);
router.get("/list", auth("GROUP_POST_R"), getGroupPostReactions);

export { router as groupPostReactionRouter };
