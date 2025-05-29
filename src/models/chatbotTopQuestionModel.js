import mongoose from "mongoose";

const chatbotTopQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  embedding: {
    type: [Number],
    required: true,
  },
  count: {
    type: Number,
    default: 1,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

const ChatbotTopQuestion = mongoose.model(
  "ChatbotTopQuestion",
  chatbotTopQuestionSchema
);

export default ChatbotTopQuestion;
