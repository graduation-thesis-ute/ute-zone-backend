import mongoose from "mongoose";

const ChatbotMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ChatbotConversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Index để tìm kiếm nhanh theo userId
  conversationId: { type: String, required: true, index: true }, // Index để tìm kiếm nhanh theo conversationId
  messages: [ChatbotMessageSchema], // Nhúng trực tiếp để tối ưu truy vấn
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Giới hạn số lượng tin nhắn tối đa (ví dụ: 100 tin nhắn)
ChatbotConversationSchema.pre("save", function (next) {
  if (this.messages.length > 100) {
    this.messages = this.messages.slice(-100);
  }
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("ChatbotConversation", ChatbotConversationSchema);
