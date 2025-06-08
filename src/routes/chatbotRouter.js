import express from "express";
import multer from "multer";
import { processPDFAndStoreVector } from "../utils/pdfProcessor.js";
import {
  searchSimilarDocuments,
  getAnswerFromDocuments,
} from "../utils/vectorSearch.js";
import { saveMessage, saveMemory } from "../utils/vectorSearch.js";
import ChatbotConversation from "../models/chatbotConversationModel.js";
import DocumentModel from "../models/chatbotDocument.js";
import ChatbotSuggestion from "../models/chatbotSuggestionModel.js";
import auth from "../middlewares/authentication.js";
import { getChatbotStats } from "../controllers/chatbotController.js";
import { MongoClient, ObjectId } from "mongodb";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const client = new MongoClient(process.env.MONGODB_URI);

// router.post("/upload", upload.single("file"), async (req, res) => {
//   try {
//     await processPDFAndStoreVector(req.file.buffer);
//     res.json({ message: "PDF uploaded and vector stored successfully." });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Upload failed" });
//   }
// });

router.post("/documents", auth(), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    const metadata = await processPDFAndStoreVector(
      req.file.buffer,
      req.file.originalname,
      title
    );
    res.json({
      message: "PDF uploaded and vector stored successfully",
      metadata,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi upload: " + err.message });
  }
});

// Get all documents (admin only)
router.get("/documents", auth(), async (req, res) => {
  try {
    const { page = 0, size = 10, name } = req.query;
    const skip = parseInt(page) * parseInt(size);
    const limit = parseInt(size);

    // Build query
    const query = {};
    if (name) {
      query.title = { $regex: name, $options: "i" }; // Case-insensitive search
    }

    // Get total count for pagination
    const total = await DocumentModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Get paginated documents
    const documents = await DocumentModel.find(query)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit)
      .select("title createdAt updatedAt vectorIds filename"); // Added filename field

    // Transform data to match frontend expectations
    const transformedDocuments = documents.map((doc) => ({
      id: doc._id,
      name: doc.title,
      type: doc.filename || "Unknown", // Use actual filename or "Unknown" if not available
      size: 0, // Since we don't store file size, default to 0
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    res.json({
      content: transformedDocuments,
      totalPages,
      totalElements: total,
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Delete document (admin only)
router.delete("/documents/:id", auth(), async (req, res) => {
  const { id } = req.params;
  try {
    const existingDoc = await DocumentModel.findById(id);
    if (!existingDoc) {
      return res.status(404).json({ error: "Document not found" });
    }

    await client.connect();
    const vectorCollection = client
      .db(process.env.DB_NAME)
      .collection(process.env.DB_COLLECTION_VECTOR_SEARCH);

    // Xóa các vector liên quan
    await vectorCollection.deleteMany({
      _id: { $in: existingDoc.vectorIds.map((id) => new ObjectId(id)) },
    });

    // Xóa metadata
    await DocumentModel.findByIdAndDelete(id);

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed: " + err.message });
  } finally {
    await client.close();
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
    console.error(error);
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

// Xóa một cuộc trò chuyện
router.delete("/conversation/:conversationId", auth(), async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id.toString();
  try {
    const result = await ChatbotConversation.findOneAndDelete({
      userId,
      conversationId,
    });

    if (!result) {
      return res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện" });
    }

    res.json({ message: "Xóa cuộc trò chuyện thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi khi xóa cuộc trò chuyện" });
  }
});

// Get all suggestions (admin only)
router.get("/suggestions", auth(), async (req, res) => {
  try {
    const { page = 0, size = 10 } = req.query;
    const skip = parseInt(page) * parseInt(size);
    const limit = parseInt(size);

    // Get total count for pagination
    const total = await ChatbotSuggestion.countDocuments();
    const totalPages = Math.ceil(total / limit);

    // Get paginated suggestions
    const suggestions = await ChatbotSuggestion.find()
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      content: suggestions,
      totalPages,
      totalElements: total,
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

// Get active suggestions for chatbot
router.get("/suggestions/active", async (req, res) => {
  try {
    const suggestions = await ChatbotSuggestion.find({ isActive: true })
      .sort({ order: 1 })
      .limit(4);
    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active suggestions" });
  }
});

// Create new suggestion (admin only)
router.post("/suggestions", auth(), async (req, res) => {
  try {
    const { icon, text, order } = req.body;
    if (!icon || !text) {
      return res.status(400).json({ error: "Icon and text are required" });
    }

    const suggestion = await ChatbotSuggestion.create({
      icon,
      text,
      order: order || 0,
    });

    res.json(suggestion);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create suggestion" });
  }
});

// Update suggestion (admin only)
router.put("/suggestions/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;
    const { icon, text, order, isActive } = req.body;

    const suggestion = await ChatbotSuggestion.findByIdAndUpdate(
      id,
      { icon, text, order, isActive },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    res.json(suggestion);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update suggestion" });
  }
});

// Delete suggestion (admin only)
router.delete("/suggestions/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;
    const suggestion = await ChatbotSuggestion.findByIdAndDelete(id);

    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    res.json({ message: "Suggestion deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete suggestion" });
  }
});

router.get("/stats", auth(), getChatbotStats);

export { router as chatbotRouter };
