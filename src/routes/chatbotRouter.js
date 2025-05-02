import express from "express";
import multer from "multer";
import { processPDFAndStoreVector } from "../utils/pdfProcessor.js";
import {
  searchSimilarDocuments,
  getAnswerFromDocuments,
} from "../utils/vectorSearch.js";

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

router.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;
    // Implement chatbot logic here
    const docs = await getAnswerFromDocuments(question);
    res.json({ results: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

export { router as chatbotRouter };
