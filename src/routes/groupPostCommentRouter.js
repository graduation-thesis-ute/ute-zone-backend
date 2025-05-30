import express from "express";
import auth from "../middlewares/authentication.js";
import {
  createComment,
  updateComment,
  deleteComment,
  getComment,
  getComments,
} from "../controllers/groupPostCommentController.js";

const router = express.Router();

router.post("/create", auth("GROUP_POST_COMMENT"), createComment);
router.put("/update", auth("GROUP_POST_COMMENT"), updateComment);
router.get("/get/:id", auth("GROUP_POST_COMMENT"), getComment);
router.delete("/delete/:id", auth("GROUP_POST_COMMENT"), deleteComment);
router.get("/list", auth("GROUP_POST_COMMENT"), getComments);

export { router as groupPostCommentRouter };
