import express from "express";
import multer from "multer";
import { processPDFAndStoreVector } from "../utils/pdfProcessor.js";
import {
  searchSimilarDocuments,
  getAnswerFromDocuments,
} from "../utils/vectorSearch.js";
import { saveMessage, saveMemory } from "../utils/vectorSearch.js";
import ChatbotMemory from "../models/chatbotMemoryModel.js";
import ChatbotConversation from "../models/chatbotConversationModel.js";
import auth from "../middlewares/authentication.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    await processPDFAndStoreVector(req.file.buffer);
    res.json({ message: "PDF uploaded and vector stored successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { question } = req.body;
    const docs = await searchSimilarDocuments(question);
    res.json({ results: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// router.post("/chat", async (req, res) => {
//   try {
//     const { question } = req.body;
//     // Implement chatbot logic here
//     const docs = await getAnswerFromDocuments(question);
//     res.json({ results: docs });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Chat failed" });
//   }
// });

// Lấy danh sách tất cả cuộc trò chuyện của người dùng
router.get("/conversations", auth(), async (req, res) => {
  const userId = req.user._id.toString();
  try {
    const conversations = await ChatbotConversation.find({ userId })
      .select("conversationId createdAt updatedAt messages")
      .sort({ updatedAt: -1 }); // Sắp xếp theo thời gian cập nhật mới nhất
    res.json(
      conversations.map((convo) => ({
        conversationId: convo.conversationId,
        createdAt: convo.createdAt,
        updatedAt: convo.updatedAt,
        title:
          convo.messages[0]?.content.slice(0, 20) + "..." ||
          "Cuộc trò chuyện mới",
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách cuộc trò chuyện" });
  }
});

// Lấy chi tiết một cuộc trò chuyện
router.get("/conversation/:conversationId", auth(), async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id.toString();
  try {
    const conversation = await ChatbotConversation.findOne({
      userId,
      conversationId,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện" });
    }
    res.json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi khi lấy chi tiết cuộc trò chuyện" });
  }
});

// Tạo cuộc trò chuyện mới
router.post("/conversation/new", auth(), async (req, res) => {
  const { conversationId } = req.body;
  const userId = req.user._id.toString();
  try {
    const newConversation = await ChatbotConversation.create({
      userId,
      conversationId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.json({ conversationId: newConversation.conversationId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi khi tạo cuộc trò chuyện mới" });
  }
});

router.get("/chat", auth(), async (req, res) => {
  const { question, conversationId } = req.query;
  const userId = req.user._id.toString();
  if (!question) {
    res.status(400).json({ error: "Missing question parameter" });
    return;
  }

  try {
    await getAnswerFromDocuments(question, userId, conversationId, res);
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: "Chat failed" })}\n\n`);
    res.end();
  }
});

// Endpoint để lấy lịch sử trò chuyện
router.get("/conversation", auth(), async (req, res) => {
  const userId = req.user._id.toString();
  console.log("ID người dùng get chatbot router:", userId);
  try {
    const history = await getConversationHistory(userId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy lịch sử trò chuyện" });
  }
});

router.get("/test-create", async (req, res) => {
  try {
    await saveMessage("testUser", "Test question", "Test answer");
    await saveMemory("testUser", "Test memory content");
    res.json({ message: "Test documents created" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as chatbotRouter };
