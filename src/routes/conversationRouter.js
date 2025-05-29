import express from "express";
import auth from "../middlewares/authentication.js";
import {
  createConversation,
  updateConversation,
  deleteConversation,
  getConversation,
  getConversations,
  updateConversationPermission,
  updateLastReadMessage,
} from "../controllers/conversationController.js";
const router = express.Router();

router.post("/create", auth("CON_C"), createConversation);
router.put("/update", auth("CON_U"), updateConversation);
router.get("/get/:id", auth("CON_V"), getConversation);
router.delete("/delete/:id", auth("CON_D"), deleteConversation);
router.get("/list", auth("CON_L"), getConversations);
router.put("/permission", auth("CON_P"), updateConversationPermission);
router.put(
  "/update-last-read/:conversationId",
  auth("CON_U"),
  updateLastReadMessage
);

export { router as conversationRouter };
