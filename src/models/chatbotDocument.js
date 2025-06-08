import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: [true, "Tiêu đề tài liệu là bắt buộc"],
    trim: true,
    maxlength: [100, "Tiêu đề không được vượt quá 100 ký tự"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  chunkCount: {
    type: Number,
    required: true,
  },
  vectorIds: [
    {
      type: String,
      required: true,
    },
  ],
});

export default mongoose.model("Document", DocumentSchema);
