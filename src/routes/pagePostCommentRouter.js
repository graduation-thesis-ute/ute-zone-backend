import express from "express";
import auth from "../middlewares/authentication.js";
import {
  createComment,
  updateComment,
  deleteComment,
  getComment,
  getComments,
} from "../controllers/pagePostCommentController.js";
const router = express.Router();

router.post("/create", auth("PAGE_POST_COM_C"), createComment);
router.put("/update", auth("PAGE_POST_COM_U"), updateComment);
router.get("/get/:id", auth("PAGE_POST_COM_V"), getComment);
router.delete("/delete/:id", auth("PAGE_POST_COM_D"), deleteComment);
router.get("/list/:id", auth("PAGE_POST_COM_L"), getComments);

export { router as pagePostCommentRouter };
