import mongoose from "mongoose";

const ChatbotMemorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  conversationId: { type: String, required: true, index: true },
  content: { type: String, required: true },
  embedding: [{ type: Number }], // Vector embedding từ HuggingFace
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("ChatbotMemory", ChatbotMemorySchema);
