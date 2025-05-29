import mongoose from "mongoose";

const chatbotSuggestionSchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const ChatbotSuggestion = mongoose.model(
  "ChatbotSuggestion",
  chatbotSuggestionSchema
);

export default ChatbotSuggestion;
