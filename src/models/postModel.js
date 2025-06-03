import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";
import PostReaction from "./postReactionModel.js";
import Comment from "./commentModel.js";
import { deleteFileByUrl } from "../services/apiService.js";
import Notification from "./notificationModel.js";

const PostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    imageUrls: {
      type: [String], // List image URLs
      default: [],
    },
    kind: {
      type: Number,
      enum: [1, 2, 3], // 1: public, 2: friend, 3: only me
      required: true,
    },
    status: {
      type: Number,
      enum: [1, 2, 3], // 1: pending, 2: accepted, 3: rejected
      default: 1,
    },
    isUpdated: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },
    // Reference to recommendation data
    recommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostRecommendation"
    }
  },
  schemaOptions
);

PostSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      // Delete associated images
      for (const imageUrl of this.imageUrls) {
        await deleteFileByUrl(imageUrl);
      }
      // Delete associated comments
      const comments = await Comment.find({ post: this._id });
      for (const comment of comments) {
        await comment.deleteOne();
      }
      // Delete associated notifications
      await Notification.deleteMany({
        "data.post._id": this._id,
      });
      // Delete associated reactions
      await PostReaction.deleteMany({ post: this._id });
      // Delete associated recommendation data
      if (this.recommendation) {
        await mongoose.model("PostRecommendation").deleteOne({ _id: this.recommendation });
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);

const Post = mongoose.model("Post", PostSchema);
export default Post;
